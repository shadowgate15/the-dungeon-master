import fs from 'node:fs'
import path from 'node:path'

/**
 * One registered Campaign folder. `name` is a cached copy of the Campaign's name, so a Missing
 * Campaign (its folder is gone) can still be shown in the library.
 */
export type RegistryEntry = { id: string; path: string; name: string }

type RegistryFile = { campaigns: RegistryEntry[] }

/**
 * The list of Campaign folders the server knows, as `registry.json` in the user-level state
 * directory. The file is read on every call, so edits by another process are picked up.
 */
export function createRegistry(home: string) {
  const file = path.join(home, 'registry.json')

  function read(): RegistryEntry[] {
    if (!fs.existsSync(file)) return []
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<RegistryFile>
    return parsed.campaigns ?? []
  }

  function write(campaigns: RegistryEntry[]) {
    fs.mkdirSync(home, { recursive: true })
    // Write then rename, so a crash never leaves a half-written registry.
    const tmp = `${file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify({ campaigns } satisfies RegistryFile, null, 2) + '\n')
    fs.renameSync(tmp, file)
  }

  return {
    list: read,

    get(id: string): RegistryEntry | undefined {
      return read().find((e) => e.id === id)
    },

    /** Adds the entry, or replaces the one with the same id (a re-added, moved folder). */
    put(entry: RegistryEntry) {
      const others = read().filter((e) => e.id !== entry.id && e.path !== entry.path)
      write([...others, entry])
    },

    remove(id: string) {
      write(read().filter((e) => e.id !== id))
    }
  }
}

export type Registry = ReturnType<typeof createRegistry>
