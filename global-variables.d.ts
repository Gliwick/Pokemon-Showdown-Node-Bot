import { AppOptionsType, ConfigType } from "./app-config";
import { Client } from "./showdown-client";
import { CommandParser as CommandParserClass } from "./command-parser";
import { DataDownloader as DataDownloaderClass } from "./data-downloader"
import { Feature } from "./features";
import { Format } from "./global-types";
import { SecurityLogger } from "./security-log"
import { Tools as ToolsType } from "./tools";
import { FlatFileManager as FlatFileManagerClass, SettingsManager } from "./settings";

declare global {
    namespace NodeJS {
        interface Global {
            AppOptions: AppOptionsType;
            Bot: Client;
            CommandParser: CommandParserClass;
            Config: ConfigType;
            DataDownloader: DataDownloaderClass;
            Features: Record<string, Feature>;
            FlatFileManager: new () => FlatFileManagerClass;
            Formats: Record<string, Format>;
            PSClient: new () => Client;
            SecurityLog: SecurityLogger;
            Settings: SettingsManager;
            Tools: ToolsType;
        }
    }
    const AppOptions: AppOptionsType;
    const Bot: Client;
    const Config: ConfigType;
    const CommandParser: CommandParserClass;
    const DataDownloader: DataDownloaderClass;
    const Features: Record<string, Feature>;
    const FlatFileManager: new () => FlatFileManagerClass;
    const Formats: Record<string, Format>;
    const PSClient: new () => Client;
    const SecurityLog: SecurityLogger;
    const Settings: SettingsManager;
    const Tools: ToolsType;
}