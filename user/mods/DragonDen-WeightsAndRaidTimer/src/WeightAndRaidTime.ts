/* eslint-disable @typescript-eslint/naming-convention */
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables"
import { IGlobals } from "@spt/models/eft/common/IGlobals"
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor"
import { ILogger } from "@spt/models/spt/utils/ILogger"
import modConfig from "../config/config.json"

export class WeightAndRaidTimeService
{
    private tables: IDatabaseTables
    private globals: IGlobals
    private logger: ILogger

    public postDBLoad(tables: IDatabaseTables, logger: ILogger): void
    {
        this.tables = tables
        this.globals = tables.globals
        this.logger = logger

        if (modConfig.raidTimeLimit?.enabled) this.adjustRaidTimeLimit()
        if (modConfig.weightChanger?.enabled) this.adjustItemWeights()
    }

    private adjustRaidTimeLimit(): void
    {
        const cfg = modConfig.raidTimeLimit
        let changed = 0

        for (const [mapId, mapData] of Object.entries(this.tables.locations))
        {
            const base = mapData?.base
            if (!base?.EscapeTimeLimit) continue
            if (!(mapId in cfg)) continue

            const before = base.EscapeTimeLimit
            const after = Number((cfg as any)[mapId])
            if (!Number.isFinite(after) || before === after) continue

            base.EscapeTimeLimit = after
            base.EscapeTimeLimitPVE = after
            base.EscapeTimeLimitCoop = (after / 2)
            changed++
            if (modConfig.debug)
                this.logDebug(`Map ${mapId} raid time modified, went from ${before} min to ${after} min`)
        }

        this.logSummary(`Raid time changed on ${changed} maps`)
    }

    private adjustItemWeights(): void {
        const cfg = modConfig.weightChanger
        const items = this.tables.templates.items || {}

        const nameToId = new Map<string, string>()
        for (const [tpl, def] of Object.entries(items)) {
            const n = String((def as any)?._name || "").trim()
            if (n) nameToId.set(n, tpl)
        }

        const normDict = (dict: Record<string, number>): Map<string, number> => {
            const m = new Map<string, number>()
            for (const [k, v] of Object.entries(dict || {})) {
                const id = nameToId.get(k) || k
                m.set(String(id), Number(v))
            }
            return m
        }
        const normSet = (arr: string[]): Set<string> => {
            const s = new Set<string>()
            for (const k of arr || []) s.add(nameToId.get(k) || k)
            return s
        }

        const perItem = normDict(cfg.perItemPercent || {})
        const perParent = normDict(cfg.perParentPercent || {})
        const wl = normSet(cfg.whitelistItem || [])
        const bl = normSet(cfg.blacklistItem || [])
        const globalPct = Number.isFinite(cfg.percent) ? Number(cfg.percent) : 100

        let changed = 0
        let zeroed = 0

        for (const [tpl, def] of Object.entries(items)) {
            const d: any = def
            const props = d?._props
            if (!props || !Number.isFinite(props.Weight)) continue

            if (bl.has(tpl) || bl.has(d._name)) continue

            const parent = String(d._parent || "")
            const directRule = perItem.has(tpl) || perItem.has(d._name)
            const parentRule = perParent.has(parent) || perParent.has(items[parent]?._name || "")

            if (wl.size > 0 && !wl.has(tpl) && !wl.has(d._name) && !directRule && !parentRule) continue

            let pct = perItem.get(tpl)
            if (!Number.isFinite(pct)) pct = perItem.get(d._name)
            if (!Number.isFinite(pct)) pct = perParent.get(parent)
            if (!Number.isFinite(pct)) {
                const pName = items[parent]?._name || ""
                pct = perParent.get(pName)
            }
            if (!Number.isFinite(pct)) pct = globalPct

            const m = Math.max(0, Number(pct)) / 100
            const before = Number(props.Weight)
            const after = Math.max(0, before * m)
            if (after === before) continue

            props.Weight = after
            changed++
            if (after === 0) zeroed++
            if (modConfig.debug)
                this.logDebug(`Weight x${this.pretty(m)} for ${d._name || tpl}, ${this.pretty(before)} -> ${this.pretty(after)} kg`)
        }

        const extra = zeroed > 0 ? `, ${zeroed} at 0 kg` : ""
        this.logSummary(`Item weights updated on ${changed} item(s)${extra}`)
    }

    private pretty(n: number): string
    {
        if (!Number.isFinite(n)) return "NaN"
        if (n === 0) return "0"

        const a = Math.abs(n)
        let s: string
        if (a >= 1000) s = n.toFixed(0)
        else if (a >= 100) s = n.toFixed(1)
        else if (a >= 10) s = n.toFixed(2)
        else if (a >= 1) s = n.toFixed(2)
        else if (a >= 0.1) s = n.toFixed(3)
        else if (a >= 0.01) s = n.toFixed(4)
        else if (a >= 0.001) s = n.toFixed(5)
        else s = n.toFixed(6)

        return s.replace(/(?:\.0+|(\.\d*?[1-9]))0+$/, "$1").replace(/\.$/, "")
    }

    private logSummary(message: string): void
    {
        this.logger.log(`[Dragon Den - Weight and Raid Time] ${message}`, LogTextColor.MAGENTA)
    }

    private logDebug(message: string): void
    {
        if (modConfig.debug)
            this.logger.log(`[Dragon Den - Weight and Raid Time] ${message}`, LogTextColor.GRAY)
    }

    private logBanner(): void
    {
        this.logger.log("======== Dragon Den - Weight and Raid Time ========", LogTextColor.MAGENTA)
    }
}
