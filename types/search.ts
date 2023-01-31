// To parse this data:
//
//   import { Convert, RoastSearchResults } from "./file";
//
//   const roastSearchResults = Convert.toRoastSearchResults(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface RoastSearchResults {
  took?: number
  timed_out?: boolean
  _shards?: Shards
  hits?: Hits
}

export interface Shards {
  total?: number
  successful?: number
  skipped?: number
  failed?: number
}

export interface Hits {
  total?: Total
  max_score?: null
  hits?: Hit[]
}

export interface Hit {
  _index?: Index
  _type?: Type
  _id?: string
  _score?: null
  _source?: Source
  sort?: number[]
}

export enum Index {
  Roasts = 'roasts',
}

export interface Source {
  url?: string
  isPrivate?: number
  userId?: string
  roastName?: string
  weightGreen?: number
  weightRoasted?: number
  totalRoastTime?: number
  dateTime?: number
  preheatTemperature?: number
  rating?: number | null
  hardware?: number
  serialNumber?: number
  roastDegree?: number
  updatedAt?: number
  deleted?: number
  firstCrackTime?: number
  firstCrackTemp?: number | null
  firstCrackIRTemp?: number | null
  recipeID?: string
  beanId?: null | string
  playbackID?: string
}

export enum Type {
  Doc = '_doc',
}

export interface Total {
  value?: number
  relation?: string
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toRoastSearchResults(json: string): RoastSearchResults {
    return cast(JSON.parse(json), r('RoastSearchResults'))
  }

  public static roastSearchResultsToJson(value: RoastSearchResults): string {
    return JSON.stringify(uncast(value, r('RoastSearchResults')), null, 2)
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
  const prettyTyp = prettyTypeName(typ)
  const parentText = parent ? ` on ${parent}` : ''
  const keyText = key ? ` for key "${key}"` : ''
  throw Error(
    `Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(
      val
    )}`
  )
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a)
        })
        .join(', ')}]`
    }
  } else if (typeof typ === 'object' && typ.literal !== undefined) {
    return typ.literal
  } else {
    return typeof typ
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }))
    typ.jsonToJS = map
  }
  return typ.jsonToJS
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }))
    typ.jsToJSON = map
  }
  return typ.jsToJSON
}

function transform(
  val: any,
  typ: any,
  getProps: any,
  key: any = '',
  parent: any = ''
): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val
    return invalidValue(typ, val, key, parent)
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length
    for (let i = 0; i < l; i++) {
      const typ = typs[i]
      try {
        return transform(val, typ, getProps)
      } catch (_) {}
    }
    return invalidValue(typs, val, key, parent)
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val
    return invalidValue(
      cases.map((a) => {
        return l(a)
      }),
      val,
      key,
      parent
    )
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l('array'), val, key, parent)
    return val.map((el) => transform(el, typ, getProps))
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null
    }
    const d = new Date(val)
    if (isNaN(d.valueOf())) {
      return invalidValue(l('Date'), val, key, parent)
    }
    return d
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any
  ): any {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      return invalidValue(l(ref || 'object'), val, key, parent)
    }
    const result: any = {}
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key]
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined
      result[prop.key] = transform(v, prop.typ, getProps, key, ref)
    })
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref)
      }
    })
    return result
  }

  if (typ === 'any') return val
  if (typ === null) {
    if (val === null) return val
    return invalidValue(typ, val, key, parent)
  }
  if (typ === false) return invalidValue(typ, val, key, parent)
  let ref: any = undefined
  while (typeof typ === 'object' && typ.ref !== undefined) {
    ref = typ.ref
    typ = typeMap[typ.ref]
  }
  if (Array.isArray(typ)) return transformEnum(typ, val)
  if (typeof typ === 'object') {
    return typ.hasOwnProperty('unionMembers')
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty('arrayItems')
      ? transformArray(typ.arrayItems, val)
      : typ.hasOwnProperty('props')
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val, key, parent)
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== 'number') return transformDate(val)
  return transformPrimitive(typ, val)
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps)
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps)
}

function l(typ: any) {
  return { literal: typ }
}

function a(typ: any) {
  return { arrayItems: typ }
}

function u(...typs: any[]) {
  return { unionMembers: typs }
}

function o(props: any[], additional: any) {
  return { props, additional }
}

function m(additional: any) {
  return { props: [], additional }
}

function r(name: string) {
  return { ref: name }
}

const typeMap: any = {
  RoastSearchResults: o(
    [
      { json: 'took', js: 'took', typ: u(undefined, 0) },
      { json: 'timed_out', js: 'timed_out', typ: u(undefined, true) },
      { json: '_shards', js: '_shards', typ: u(undefined, r('Shards')) },
      { json: 'hits', js: 'hits', typ: u(undefined, r('Hits')) },
    ],
    false
  ),
  Shards: o(
    [
      { json: 'total', js: 'total', typ: u(undefined, 0) },
      { json: 'successful', js: 'successful', typ: u(undefined, 0) },
      { json: 'skipped', js: 'skipped', typ: u(undefined, 0) },
      { json: 'failed', js: 'failed', typ: u(undefined, 0) },
    ],
    false
  ),
  Hits: o(
    [
      { json: 'total', js: 'total', typ: u(undefined, r('Total')) },
      { json: 'max_score', js: 'max_score', typ: u(undefined, null) },
      { json: 'hits', js: 'hits', typ: u(undefined, a(r('Hit'))) },
    ],
    false
  ),
  Hit: o(
    [
      { json: '_index', js: '_index', typ: u(undefined, r('Index')) },
      { json: '_type', js: '_type', typ: u(undefined, r('Type')) },
      { json: '_id', js: '_id', typ: u(undefined, '') },
      { json: '_score', js: '_score', typ: u(undefined, null) },
      { json: '_source', js: '_source', typ: u(undefined, r('Source')) },
      { json: 'sort', js: 'sort', typ: u(undefined, a(0)) },
    ],
    false
  ),
  Source: o(
    [
      { json: 'url', js: 'url', typ: u(undefined, '') },
      { json: 'isPrivate', js: 'isPrivate', typ: u(undefined, 0) },
      { json: 'userId', js: 'userId', typ: u(undefined, '') },
      { json: 'roastName', js: 'roastName', typ: u(undefined, '') },
      { json: 'weightGreen', js: 'weightGreen', typ: u(undefined, 3.14) },
      { json: 'weightRoasted', js: 'weightRoasted', typ: u(undefined, 3.14) },
      { json: 'totalRoastTime', js: 'totalRoastTime', typ: u(undefined, 0) },
      { json: 'dateTime', js: 'dateTime', typ: u(undefined, 0) },
      {
        json: 'preheatTemperature',
        js: 'preheatTemperature',
        typ: u(undefined, 0),
      },
      { json: 'rating', js: 'rating', typ: u(undefined, u(0, null)) },
      { json: 'hardware', js: 'hardware', typ: u(undefined, 0) },
      { json: 'serialNumber', js: 'serialNumber', typ: u(undefined, 0) },
      { json: 'roastDegree', js: 'roastDegree', typ: u(undefined, 0) },
      { json: 'updatedAt', js: 'updatedAt', typ: u(undefined, 0) },
      { json: 'deleted', js: 'deleted', typ: u(undefined, 0) },
      { json: 'firstCrackTime', js: 'firstCrackTime', typ: u(undefined, 3.14) },
      {
        json: 'firstCrackTemp',
        js: 'firstCrackTemp',
        typ: u(undefined, u(3.14, null)),
      },
      {
        json: 'firstCrackIRTemp',
        js: 'firstCrackIRTemp',
        typ: u(undefined, u(3.14, null)),
      },
      { json: 'recipeID', js: 'recipeID', typ: u(undefined, '') },
      { json: 'beanId', js: 'beanId', typ: u(undefined, u(null, '')) },
      { json: 'playbackID', js: 'playbackID', typ: u(undefined, '') },
    ],
    false
  ),
  Total: o(
    [
      { json: 'value', js: 'value', typ: u(undefined, 0) },
      { json: 'relation', js: 'relation', typ: u(undefined, '') },
    ],
    false
  ),
  Index: ['roasts'],
  Type: ['_doc'],
}
