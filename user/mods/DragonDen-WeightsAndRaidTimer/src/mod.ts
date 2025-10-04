/* eslint-disable @typescript-eslint/naming-convention */

import { DependencyContainer } from "tsyringe";
import * as fs from "fs";
import * as path from "path";

// SPT types
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ILogger } from "@spt/models/spt/utils/ILogger";

// Custom imports
import { WeightAndRaidTimeService } from "./WeightAndRaidTime";

class DragonDenWeightsAndRaidTime implements IPreSptLoadMod, IPostDBLoadMod {
    private weightAndRaidTimeService: WeightAndRaidTimeService = new WeightAndRaidTimeService();
    private logger: ILogger;

    private version: string;
    private modName = "DragonDen-WeightsAndRaidTime";

    public preSptLoad(container: DependencyContainer): void
    {
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.logger.info(`[${this.modName}] preSptLoad started`);

        this.getVersionFromJson();
    }

    public postDBLoad(container: DependencyContainer): void
    {
        const databaseServer: DatabaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const tables = databaseServer.getTables();

        this.weightAndRaidTimeService.postDBLoad(tables, this.logger);

        this.logger.success(`[${this.modName}] postDBLoad finished`);
    }

    private getVersionFromJson(): void
    {
        const packageJsonPath = path.join(__dirname, "../package.json");
        try
        {
            const data = fs.readFileSync(packageJsonPath, "utf-8");
            const jsonData = JSON.parse(data);
            this.version = jsonData.version;
        }
        catch (err)
        {
            console.error("Error reading version from package.json:", err);
        }
    }
}

module.exports = { mod: new DragonDenWeightsAndRaidTime() };
