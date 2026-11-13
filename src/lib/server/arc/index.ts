import { db } from '../db/index.ts'
import { createArcService } from './service.ts'

/** Server-only singleton: the Arc service over the real database. */
export const arcs = createArcService(db)
