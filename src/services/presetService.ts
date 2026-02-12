import { v4 as uuidv4 } from 'uuid'

export interface PresetOperation {
    type: string
    params: Record<string, any>
}

export interface Preset {
    id: string
    name: string
    createdAt: number
    operations: PresetOperation[]
}

const STORAGE_KEY = 'regex-batch-renamer-presets'

export function loadPresets(): Preset[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function persistPresets(presets: Preset[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
}

export function savePreset(name: string, operations: { type: string; enabled: boolean; params: Record<string, any> }[]): Preset {
    const preset: Preset = {
        id: uuidv4(),
        name,
        createdAt: Date.now(),
        operations: operations.map(op => ({
            type: op.type,
            params: { ...op.params },
        })),
    }

    const presets = loadPresets()
    presets.push(preset)
    persistPresets(presets)
    return preset
}

export function deletePreset(id: string): void {
    const presets = loadPresets().filter(p => p.id !== id)
    persistPresets(presets)
}

export function renamePreset(id: string, newName: string): void {
    const presets = loadPresets()
    const target = presets.find(p => p.id === id)
    if (target) {
        target.name = newName
        persistPresets(presets)
    }
}

export function exportPresetsJSON(): string {
    return JSON.stringify(loadPresets(), null, 2)
}

export function importPresetsJSON(json: string): { count: number; skipped: number } {
    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    } catch {
        throw new Error('INVALID_JSON')
    }

    if (!Array.isArray(parsed)) throw new Error('NOT_ARRAY')

    const valid = parsed.filter((p: any) =>
        typeof p === 'object' && p !== null
        && typeof p.name === 'string' && p.name.trim().length > 0
        && Array.isArray(p.operations) && p.operations.length > 0
        && p.operations.every((op: any) =>
            typeof op === 'object' && op !== null
            && typeof op.type === 'string'
            && typeof op.params === 'object' && op.params !== null
        )
    )

    if (valid.length === 0) throw new Error('NO_VALID')

    const existing = loadPresets()

    const fingerprint = (name: string, ops: any[]) =>
        `${name}::${JSON.stringify(ops.map((o: any) => ({ type: o.type, params: o.params })))}`

    const existingFingerprints = new Set(
        existing.map(p => fingerprint(p.name, p.operations))
    )

    const deduped = valid.filter((p: any) =>
        !existingFingerprints.has(fingerprint(p.name, p.operations))
    )

    const newPresets = deduped.map((p: any) => ({
        id: uuidv4(),
        name: p.name.trim(),
        createdAt: typeof p.createdAt === 'number' ? p.createdAt : Date.now(),
        operations: p.operations.map((op: any) => ({
            type: op.type,
            params: { ...op.params },
        })),
    }))

    persistPresets([...existing, ...newPresets])
    return { count: newPresets.length, skipped: valid.length - newPresets.length }
}
