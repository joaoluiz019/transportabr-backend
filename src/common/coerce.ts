import { BadRequestException } from '@nestjs/common';

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'uuid' | 'enum';

export interface FieldDef {
  type: FieldType;
  required?: boolean;
  values?: string[]; // para type 'enum'
}

export interface EntitySpec {
  model: string; // chave do delegate Prisma (ex.: 'driver')
  fields: Record<string, FieldDef>;
  filter?: string[]; // campos permitidos para filtro por igualdade no list()
  relations?: { field: string; model: string }[]; // valida que o alvo é da mesma empresa
  orderBy?: Record<string, 'asc' | 'desc'>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isBlank = (v: any) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/**
 * Converte um valor cru (vindo de JSON/query string) para o tipo esperado.
 * Retorna `undefined` quando o valor é "branco" (deve ser tratado como null/ausente).
 * Lança BadRequest para uuid/enum inválidos ou números/datas mal formados.
 */
export function coerce(type: FieldType, raw: any, values?: string[]): any {
  if (isBlank(raw)) return undefined;

  switch (type) {
    case 'string':
      return String(raw);
    case 'uuid': {
      const s = String(raw);
      if (!UUID_RE.test(s)) throw new BadRequestException(`UUID inválido: ${s}`);
      return s;
    }
    case 'enum': {
      const s = String(raw);
      if (values && !values.includes(s))
        throw new BadRequestException(`Valor inválido "${s}" (esperado: ${values.join(', ')})`);
      return s;
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 || raw === '1';
    case 'number': {
      const n = Number(String(raw).replace(',', '.'));
      if (isNaN(n)) throw new BadRequestException(`Número inválido: ${raw}`);
      return n;
    }
    case 'date': {
      const d = new Date(String(raw).replace(/(\.\d{3})\d+/, '$1'));
      if (isNaN(d.getTime())) throw new BadRequestException(`Data inválida: ${raw}`);
      return d;
    }
  }
}

/**
 * Constrói o objeto de dados para o Prisma a partir do corpo da requisição,
 * aceitando apenas os campos declarados no spec e coagindo os tipos.
 * Campos do servidor (id, company_id, timestamps) nunca são aceitos do cliente.
 *
 * @param partial true para update (não exige obrigatórios e ignora ausentes).
 */
export function sanitize(spec: EntitySpec, body: any, partial: boolean): Record<string, any> {
  if (!body || typeof body !== 'object')
    throw new BadRequestException('Corpo da requisição inválido');

  const data: Record<string, any> = {};
  for (const [name, def] of Object.entries(spec.fields)) {
    if (!(name in body)) {
      if (def.required && !partial)
        throw new BadRequestException(`Campo obrigatório ausente: ${name}`);
      continue;
    }
    const value = coerce(def.type, body[name], def.values);
    if (value === undefined) {
      // valor branco enviado explicitamente
      if (def.required && !partial)
        throw new BadRequestException(`Campo obrigatório vazio: ${name}`);
      data[name] = null;
    } else {
      data[name] = value;
    }
  }
  return data;
}
