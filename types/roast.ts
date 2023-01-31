// To parse this data:
//
//   import { Convert, RoastData } from "./file";
//
//   const roastData = Convert.toRoastData(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

export interface RoastData {
  beanChargeTemperature?: number
  beanDropTemperature?: number
  drumChargeTemperature?: number
  drumDropTemperature?: number
  beanTemperature?: number[]
  drumTemperature?: number[]
  beanDerivative?: number[]
  ibtsDerivative?: number[]
  exitTemperature?: number[]
  preheatTemperature?: number
  roastStartIndex?: number
  roastEndIndex?: number
  totalRoastTime?: number
  indexFirstCrackStart?: number
  indexFirstCrackEnd?: number
  indexSecondCrackStart?: number
  indexSecondCrackEnd?: number
  indexYellowingStart?: number
  weightGreen?: string
  weightRoasted?: string
  roastNumber?: number
  sampleRate?: number
  serialNumber?: number
  hardware?: number
  IRSensor?: number
  firmware?: number
  actions?: Actions
  missingSeconds?: any[]
  rorPreheat?: number
  uid?: string
  userId?: string
  dateTime?: number
  softwareVersion?: string
  firmwareVersion?: number
  roastName?: string
  ambient?: number
  humidity?: number
  beanId?: string
  updatedAt?: number
  roastDegree?: number
  guid?: string
  isPrivate?: number
}

export interface Actions {
  actionTempList?: any[]
  actionTimeList?: ActionTimeList[]
}

export interface ActionTimeList {
  ctrlType?: number
  index?: number
  value?: number
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toRoastData(json: string): RoastData {
    return cast(JSON.parse(json), r('RoastData'))
  }

  public static roastDataToJson(value: RoastData): string {
    return JSON.stringify(uncast(value, r('RoastData')), null, 2)
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
  RoastData: o(
    [
      {
        json: 'beanChargeTemperature',
        js: 'beanChargeTemperature',
        typ: u(undefined, 3.14),
      },
      {
        json: 'beanDropTemperature',
        js: 'beanDropTemperature',
        typ: u(undefined, 3.14),
      },
      {
        json: 'drumChargeTemperature',
        js: 'drumChargeTemperature',
        typ: u(undefined, 3.14),
      },
      {
        json: 'drumDropTemperature',
        js: 'drumDropTemperature',
        typ: u(undefined, 0),
      },
      {
        json: 'beanTemperature',
        js: 'beanTemperature',
        typ: u(undefined, a(3.14)),
      },
      {
        json: 'drumTemperature',
        js: 'drumTemperature',
        typ: u(undefined, a(3.14)),
      },
      {
        json: 'beanDerivative',
        js: 'beanDerivative',
        typ: u(undefined, a(3.14)),
      },
      {
        json: 'ibtsDerivative',
        js: 'ibtsDerivative',
        typ: u(undefined, a(3.14)),
      },
      {
        json: 'exitTemperature',
        js: 'exitTemperature',
        typ: u(undefined, a(0)),
      },
      {
        json: 'preheatTemperature',
        js: 'preheatTemperature',
        typ: u(undefined, 0),
      },
      { json: 'roastStartIndex', js: 'roastStartIndex', typ: u(undefined, 0) },
      { json: 'roastEndIndex', js: 'roastEndIndex', typ: u(undefined, 0) },
      { json: 'totalRoastTime', js: 'totalRoastTime', typ: u(undefined, 0) },
      {
        json: 'indexFirstCrackStart',
        js: 'indexFirstCrackStart',
        typ: u(undefined, 0),
      },
      {
        json: 'indexFirstCrackEnd',
        js: 'indexFirstCrackEnd',
        typ: u(undefined, 0),
      },
      {
        json: 'indexSecondCrackStart',
        js: 'indexSecondCrackStart',
        typ: u(undefined, 0),
      },
      {
        json: 'indexSecondCrackEnd',
        js: 'indexSecondCrackEnd',
        typ: u(undefined, 0),
      },
      {
        json: 'indexYellowingStart',
        js: 'indexYellowingStart',
        typ: u(undefined, 0),
      },
      { json: 'weightGreen', js: 'weightGreen', typ: u(undefined, '') },
      { json: 'weightRoasted', js: 'weightRoasted', typ: u(undefined, '') },
      { json: 'roastNumber', js: 'roastNumber', typ: u(undefined, 0) },
      { json: 'sampleRate', js: 'sampleRate', typ: u(undefined, 0) },
      { json: 'serialNumber', js: 'serialNumber', typ: u(undefined, 0) },
      { json: 'hardware', js: 'hardware', typ: u(undefined, 0) },
      { json: 'IRSensor', js: 'IRSensor', typ: u(undefined, 0) },
      { json: 'firmware', js: 'firmware', typ: u(undefined, 0) },
      { json: 'actions', js: 'actions', typ: u(undefined, r('Actions')) },
      {
        json: 'missingSeconds',
        js: 'missingSeconds',
        typ: u(undefined, a('any')),
      },
      { json: 'rorPreheat', js: 'rorPreheat', typ: u(undefined, 3.14) },
      { json: 'uid', js: 'uid', typ: u(undefined, '') },
      { json: 'userId', js: 'userId', typ: u(undefined, '') },
      { json: 'dateTime', js: 'dateTime', typ: u(undefined, 0) },
      { json: 'softwareVersion', js: 'softwareVersion', typ: u(undefined, '') },
      { json: 'firmwareVersion', js: 'firmwareVersion', typ: u(undefined, 0) },
      { json: 'roastName', js: 'roastName', typ: u(undefined, '') },
      { json: 'ambient', js: 'ambient', typ: u(undefined, 0) },
      { json: 'humidity', js: 'humidity', typ: u(undefined, 0) },
      { json: 'beanId', js: 'beanId', typ: u(undefined, '') },
      { json: 'updatedAt', js: 'updatedAt', typ: u(undefined, 0) },
      { json: 'roastDegree', js: 'roastDegree', typ: u(undefined, 0) },
      { json: 'guid', js: 'guid', typ: u(undefined, '') },
      { json: 'isPrivate', js: 'isPrivate', typ: u(undefined, 0) },
    ],
    false
  ),
  Actions: o(
    [
      {
        json: 'actionTempList',
        js: 'actionTempList',
        typ: u(undefined, a('any')),
      },
      {
        json: 'actionTimeList',
        js: 'actionTimeList',
        typ: u(undefined, a(r('ActionTimeList'))),
      },
    ],
    false
  ),
  ActionTimeList: o(
    [
      { json: 'ctrlType', js: 'ctrlType', typ: u(undefined, 0) },
      { json: 'index', js: 'index', typ: u(undefined, 0) },
      { json: 'value', js: 'value', typ: u(undefined, 0) },
    ],
    false
  ),
}
