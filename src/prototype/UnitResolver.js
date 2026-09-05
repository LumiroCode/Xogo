/** Resolve platform + weapon + specialization according to the MVP JSON rules. */
export function resolveAssembly(defs, assembly) {
  const platform = defs.platforms[assembly.platform];
  const weapon = defs.weapons[assembly.weapon ?? 'none'];
  const spec = defs.specializations[assembly.specialization] ?? { add: {}, multiply: {} };
  if (!platform) throw new Error(`Unknown platform: ${assembly.platform}`);
  if (!weapon) throw new Error(`Unknown weapon: ${assembly.weapon}`);

  const out = { ...platform, ...weapon };
  for (const [key, value] of Object.entries(spec.add ?? {})) out[key] = (out[key] ?? 0) + value;
  for (const [key, value] of Object.entries(spec.multiply ?? {})) out[key] = (out[key] ?? 0) * value;
  out.size = out.footprint * out.height;
  out.weight = out.size;
  out.supplyState = out.supplyCapacity;
  out.weaponId = assembly.weapon ?? 'none';
  out.specializationId = assembly.specialization;
  return out;
}

export function assemblyFromConfiguration(defs, configurationId) {
  const c = defs.test_configurations[configurationId];
  if (!c) throw new Error(`Unknown test configuration: ${configurationId}`);
  return { platform: c.platform, weapon: c.weapon, specialization: c.specialization };
}
