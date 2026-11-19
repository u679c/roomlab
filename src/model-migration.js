// Recognize complete surface sets from both earlier versions of this house.
export function readSurfaceMigration(root) {
  const original = { sourceIds: new Set(), aliases: new Map(), removed: new Set() };
  const previous = { sourceIds: new Set(), aliases: new Map(), removed: new Set() };
  const collect = (data, target, idsKey, aliasesKey, removedKey) => {
    for (const id of JSON.parse(data[idsKey] || '[]')) target.sourceIds.add(id);
    for (const [oldId, newId] of Object.entries(JSON.parse(data[aliasesKey] || '{}'))) target.aliases.set(oldId, newId);
    for (const id of JSON.parse(data[removedKey] || '[]')) target.removed.add(id);
  };
  root.traverse(object => {
    if (!object.isMesh) return;
    collect(object.userData, original, 'roomlab_source_planes', 'roomlab_surface_aliases', 'roomlab_removed_planes');
    collect(object.userData, previous, 'roomlab_previous_planes', 'roomlab_previous_aliases', 'roomlab_previous_removed');
  });
  return { ...original, variants: [original, previous].filter(item => item.sourceIds.size) };
}
export function migrateSurfaceProject(project, defaults, metadata) {
  if (!project || project.version !== 1 || project.model !== 'apartment-v1' || !Array.isArray(project.surfaces) || !defaults || !metadata?.sourceIds.size) return project;
  const entries = project.surfaces;
  if (entries.length === defaults.size && entries.every(entry => defaults.has(entry?.id))) return project;
  const ids = new Set(entries.map(entry => entry?.id));
  if (entries.length !== ids.size) return project;
  const variant = (metadata.variants || [metadata]).find(item => ids.size === item.sourceIds.size && [...ids].every(id => item.sourceIds.has(id)));
  if (!variant) return project;
  const specs = new Map([...defaults].map(([id, spec]) => [id, { ...spec }]));
  for (const entry of entries) {
    if (variant.removed.has(entry.id)) continue;
    const target = variant.aliases.get(entry.id) || entry.id;
    if (!specs.has(target)) return project;
    specs.set(target, entry.spec);
  }
  return { ...project, surfaces: [...specs].map(([id, spec]) => ({ id, spec })) };
}
