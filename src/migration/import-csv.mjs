/**
 * Importa os CSVs exportados do Base44 para o PostgreSQL, convertendo os IDs
 * (ObjectId de 24 hex) para UUID e religando todas as FKs.
 *
 * Uso:
 *   DATABASE_URL=... node src/migration/import-csv.mjs [pasta-dos-csvs]
 *   (ou)  npm run import:csv
 *
 * Regras:
 *  - Gera um UUID novo por registro; mantém mapa oldId -> newUuid por entidade.
 *  - FK obrigatória sem alvo => linha é "órfã" e é PULADA (com log).
 *  - FK opcional sem alvo => vira null (com log).
 *  - date obrigatória vazia => cai para a data de created_date.
 *  - role "user" do Base44 => "driver"; "admin" => "admin".
 *  - Trunca as tabelas antes de importar (re-execução limpa).
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DOWNLOADS = process.argv[2] || 'C:/Users/João Luiz/Downloads';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const readCsv = (file) => {
  const text = readFileSync(join(DOWNLOADS, file), 'utf8');
  return parse(text, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
  });
};

const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

const toDate = (v) => {
  if (isBlank(v)) return null;
  // normaliza microssegundos (.898000) para milissegundos (.898)
  const s = String(v).replace(/(\.\d{3})\d+/, '$1');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const toNum = (v) => {
  if (isBlank(v)) return null;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
};

const toInt = (v) => {
  const n = toNum(v);
  return n === null ? null : Math.trunc(n);
};

const EXPENSE_TYPES = new Set([
  'maintenance', 'oil_change', 'tire', 'insurance', 'tax', 'fine', 'payroll',
  'commission', 'travel_bonus', 'overnight', 'toll', 'bonus', 'body',
  'financiamento', 'other',
]);
const FUEL_TYPES = new Set(['gasoline', 'ethanol', 'diesel', 'gnv']);
const DRIVER_STATUS = new Set(['active', 'inactive']);
const VEHICLE_STATUS = new Set(['active', 'maintenance', 'inactive']);

const orphans = [];
const logOrphan = (entity, oldId, reason) =>
  orphans.push(`  [${entity}] id=${oldId} pulado: ${reason}`);

// mapas oldObjectId -> newUuid
const companyMap = new Map();
const vehicleMap = new Map();
const driverMap = new Map();

// novo id por registro, registrado no mapa correspondente
const newId = (map, oldId) => {
  const id = randomUUID();
  if (oldId) map.set(oldId, id);
  return id;
};

async function main() {
  console.log(`Lendo CSVs de: ${DOWNLOADS}\n`);

  // --- limpa as tabelas (ordem irrelevante por causa do CASCADE) ---
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "advances","billings","expenses","fuelings","driver_invites","drivers","vehicles","companies","users" RESTART IDENTITY CASCADE;`,
  );

  // ----------------------------------------------------------------- Company
  const companies = readCsv('Company_export.csv').map((r) => ({
    id: newId(companyMap, r.id),
    name: r.name,
    cnpj: r.cnpj ?? '',
    address: isBlank(r.address) ? null : r.address,
    phone: isBlank(r.phone) ? null : r.phone,
    owner_email: r.owner_email,
    created_at: toDate(r.created_date) ?? new Date(),
  }));
  await prisma.company.createMany({ data: companies });
  console.log(`Company:  ${companies.length} inseridas`);

  // ----------------------------------------------------------------- Vehicle
  // Insere sem driver_id (relação circular); guarda driver antigo p/ patch.
  const vehiclePatch = []; // { id, oldDriverId }
  const vehicles = [];
  for (const r of readCsv('Vehicle_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    if (!company_id) { logOrphan('Vehicle', r.id, `company ${r.company_id} inexistente`); continue; }
    const id = newId(vehicleMap, r.id);
    if (!isBlank(r.driver_id)) vehiclePatch.push({ id, oldDriverId: r.driver_id });
    vehicles.push({
      id,
      company_id,
      plate: r.plate,
      model: r.model,
      year: toInt(r.year),
      brand: r.brand,
      mileage: toNum(r.mileage),
      driver_id: null,
      driver_name: isBlank(r.driver_name) ? null : r.driver_name,
      status: VEHICLE_STATUS.has(r.status) ? r.status : 'active',
      registration_expiry: toDate(r.registration_expiry),
      desired_km_per_liter: toNum(r.desired_km_per_liter),
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.vehicle.createMany({ data: vehicles });
  console.log(`Vehicle:  ${vehicles.length} inseridos`);

  // ------------------------------------------------------------------ Driver
  const drivers = [];
  for (const r of readCsv('Driver_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    if (!company_id) { logOrphan('Driver', r.id, `company ${r.company_id} inexistente`); continue; }
    drivers.push({
      id: newId(driverMap, r.id),
      company_id,
      name: r.name,
      email: isBlank(r.email) ? null : r.email,
      phone: isBlank(r.phone) ? null : r.phone,
      cnh: isBlank(r.cnh) ? null : r.cnh,
      cnh_expiry: toDate(r.cnh_expiry),
      toxicological_expiry: toDate(r.toxicological_expiry),
      commission_percent: toNum(r.commission_percent),
      vehicle_id: isBlank(r.vehicle_id) ? null : (vehicleMap.get(r.vehicle_id) ?? null),
      status: DRIVER_STATUS.has(r.status) ? r.status : 'active',
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.driver.createMany({ data: drivers });
  console.log(`Driver:   ${drivers.length} inseridos`);

  // --- patch: vehicle.driver_id agora que os drivers existem ---
  let patched = 0;
  for (const { id, oldDriverId } of vehiclePatch) {
    const driver_id = driverMap.get(oldDriverId);
    if (!driver_id) { logOrphan('Vehicle.driver_id', id, `driver ${oldDriverId} inexistente -> null`); continue; }
    await prisma.vehicle.update({ where: { id }, data: { driver_id } });
    patched++;
  }
  console.log(`          ${patched} vinculos vehicle->driver religados`);

  // ----------------------------------------------------------------- Advance
  const advances = [];
  for (const r of readCsv('Advance_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    const driver_id = driverMap.get(r.driver_id);
    if (!company_id) { logOrphan('Advance', r.id, `company ${r.company_id} inexistente`); continue; }
    if (!driver_id) { logOrphan('Advance', r.id, `driver ${r.driver_id} inexistente`); continue; }
    advances.push({
      id: randomUUID(),
      company_id,
      driver_id,
      driver_name: isBlank(r.driver_name) ? null : r.driver_name,
      amount: toNum(r.amount) ?? 0,
      date: toDate(r.date) ?? toDate(r.created_date),
      description: isBlank(r.description) ? null : r.description,
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.advance.createMany({ data: advances });
  console.log(`Advance:  ${advances.length} inseridos`);

  // ----------------------------------------------------------------- Billing
  const billings = [];
  for (const r of readCsv('Billing_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    const vehicle_id = vehicleMap.get(r.vehicle_id);
    if (!company_id) { logOrphan('Billing', r.id, `company ${r.company_id} inexistente`); continue; }
    if (!vehicle_id) { logOrphan('Billing', r.id, `vehicle ${r.vehicle_id} inexistente`); continue; }
    billings.push({
      id: randomUUID(),
      company_id,
      vehicle_id,
      vehicle_plate: isBlank(r.vehicle_plate) ? null : r.vehicle_plate,
      client_name: r.client_name ?? '',
      amount: toNum(r.amount) ?? 0,
      date: toDate(r.date) ?? toDate(r.created_date),
      destination: isBlank(r.destination) ? null : r.destination,
      notes: isBlank(r.notes) ? null : r.notes,
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.billing.createMany({ data: billings });
  console.log(`Billing:  ${billings.length} inseridos`);

  // ----------------------------------------------------------------- Expense
  const expenses = [];
  for (const r of readCsv('Expense_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    const vehicle_id = vehicleMap.get(r.vehicle_id);
    if (!company_id) { logOrphan('Expense', r.id, `company ${r.company_id} inexistente`); continue; }
    if (!vehicle_id) { logOrphan('Expense', r.id, `vehicle ${r.vehicle_id} inexistente`); continue; }
    expenses.push({
      id: randomUUID(),
      company_id,
      vehicle_id,
      vehicle_plate: isBlank(r.vehicle_plate) ? null : r.vehicle_plate,
      type: EXPENSE_TYPES.has(r.type) ? r.type : 'other',
      amount: toNum(r.amount) ?? 0,
      date: toDate(r.date) ?? toDate(r.created_date),
      supplier: isBlank(r.supplier) ? null : r.supplier,
      description: isBlank(r.description) ? null : r.description,
      mileage_at_service: toNum(r.mileage_at_service),
      next_service_mileage: toNum(r.next_service_mileage),
      next_service_date: toDate(r.next_service_date),
      tire_brand: isBlank(r.tire_brand) ? null : r.tire_brand,
      tire_model: isBlank(r.tire_model) ? null : r.tire_model,
      tire_position: isBlank(r.tire_position) ? null : r.tire_position,
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.expense.createMany({ data: expenses });
  console.log(`Expense:  ${expenses.length} inseridos`);

  // ----------------------------------------------------------------- Fueling
  const fuelings = [];
  for (const r of readCsv('Fueling_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    const vehicle_id = vehicleMap.get(r.vehicle_id);
    if (!company_id) { logOrphan('Fueling', r.id, `company ${r.company_id} inexistente`); continue; }
    if (!vehicle_id) { logOrphan('Fueling', r.id, `vehicle ${r.vehicle_id} inexistente`); continue; }
    fuelings.push({
      id: randomUUID(),
      company_id,
      vehicle_id,
      vehicle_plate: isBlank(r.vehicle_plate) ? null : r.vehicle_plate,
      date: toDate(r.date) ?? toDate(r.created_date),
      mileage: toNum(r.mileage) ?? 0,
      liters: toNum(r.liters) ?? 0,
      price_per_liter: toNum(r.price_per_liter) ?? 0,
      total_cost: toNum(r.total_cost) ?? 0,
      fuel_type: FUEL_TYPES.has(r.fuel_type) ? r.fuel_type : null,
      station: isBlank(r.station) ? null : r.station,
      km_per_liter: toNum(r.km_per_liter),
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.fueling.createMany({ data: fuelings });
  console.log(`Fueling:  ${fuelings.length} inseridos`);

  // ------------------------------------------------------------- DriverInvite
  const invites = [];
  for (const r of readCsv('DriverInvite_export.csv')) {
    const company_id = companyMap.get(r.company_id);
    const driver_id = driverMap.get(r.driver_id);
    if (!company_id) { logOrphan('DriverInvite', r.id, `company ${r.company_id} inexistente`); continue; }
    if (!driver_id) { logOrphan('DriverInvite', r.id, `driver ${r.driver_id} inexistente`); continue; }
    invites.push({
      id: randomUUID(),
      company_id,
      driver_id,
      vehicle_id: isBlank(r.vehicle_id) ? null : (vehicleMap.get(r.vehicle_id) ?? null),
      token: r.token,
      store_url: isBlank(r.store_url) ? null : r.store_url,
      is_active: String(r.is_active).toLowerCase() !== 'false',
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.driverInvite.createMany({ data: invites });
  console.log(`DriverInvite: ${invites.length} inseridos`);

  // -------------------------------------------------------------------- User
  const seenEmail = new Set();
  const users = [];
  for (const r of readCsv('User_export.csv')) {
    if (isBlank(r.email)) { logOrphan('User', r.id, 'email vazio'); continue; }
    const email = String(r.email).toLowerCase();
    if (seenEmail.has(email)) { logOrphan('User', r.id, `email duplicado ${email}`); continue; }
    seenEmail.add(email);
    users.push({
      id: randomUUID(),
      email: r.email,
      name: isBlank(r.full_name) ? null : r.full_name,
      password_hash: null,
      role: r.role === 'admin' ? 'admin' : 'driver',
      provider: null,
      provider_id: null,
      company_id: isBlank(r.company_id) ? null : (companyMap.get(r.company_id) ?? null),
      driver_id: null,
      vehicle_id: null,
      created_at: toDate(r.created_date) ?? new Date(),
    });
  }
  await prisma.user.createMany({ data: users });
  console.log(`User:     ${users.length} inseridos`);

  // ------------------------------------------------------------------ Relatório
  console.log(`\n=== Órfãos pulados: ${orphans.length} ===`);
  if (orphans.length) console.log(orphans.join('\n'));

  console.log('\n=== Contagem final no banco ===');
  for (const [name, model] of [
    ['companies', prisma.company], ['vehicles', prisma.vehicle], ['drivers', prisma.driver],
    ['advances', prisma.advance], ['billings', prisma.billing], ['expenses', prisma.expense],
    ['fuelings', prisma.fueling], ['driver_invites', prisma.driverInvite], ['users', prisma.user],
  ]) {
    console.log(`  ${name}: ${await model.count()}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('\nERRO na importação:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
