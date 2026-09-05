/**
 * Generic data -> presentation binding layer.
 *
 * This class has no knowledge of HP, suppression, ammo, factions, weapons, etc.
 * Domain field names live only in external JSON bindings.
 */
export class PresentationBinder {
  constructor(config = {}) {
    this.config = config;
  }

  bindEntity(source) {
    const cfg = this.config.entity ?? {};
    const out = {};

    for (const [target, binding] of Object.entries(cfg.fields ?? {})) {
      const value = typeof binding === 'string' ? this._get(source, binding) : this._resolve(binding, source);
      if (value !== undefined) out[target] = structuredClone(value);
    }

    const indicators = [];
    for (const template of cfg.indicators ?? []) {
      if (!this._matches(source, template.when)) continue;
      const resolved = this._resolve(template, source);
      delete resolved.when;
      indicators.push(resolved);
    }

    const appended = cfg.appendIndicatorsFrom ? this._get(source, cfg.appendIndicatorsFrom) : null;
    if (Array.isArray(appended)) indicators.push(...structuredClone(appended));

    if (indicators.length) out.indicators = indicators;
    return out;
  }

  _resolve(value, source) {
    if (Array.isArray(value)) return value.map(v => this._resolve(v, source));
    if (!value || typeof value !== 'object') return value;

    if (Object.keys(value).length === 1 && typeof value.source === 'string') {
      return this._get(source, value.source);
    }

    if (Object.keys(value).length === 1 && value.select && typeof value.select === 'object') {
      const selector = value.select;
      const key = String(this._get(source, selector.source));
      const selected = Object.prototype.hasOwnProperty.call(selector.values ?? {}, key)
        ? selector.values[key]
        : selector.default;
      return this._resolve(selected, source);
    }

    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = this._resolve(v, source);
    return out;
  }

  _matches(source, condition) {
    if (!condition) return true;
    const actual = this._get(source, condition.source);
    if (Object.prototype.hasOwnProperty.call(condition, 'equals')) return actual === condition.equals;
    if (Array.isArray(condition.oneOf)) return condition.oneOf.includes(actual);
    return Boolean(actual);
  }

  _get(source, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce((value, key) => value?.[key], source);
  }
}
