import { AppOptionsType, Tools as ToolsManager } from "./tools";
import { Client } from "./showdown-client";
import { CommandParser as CommandParserClass } from "./command-parser";
import { ConfigType, Format } from "./global-types";
import { DataDownloader as DataDownloaderClass } from "./data-downloader"
import { Feature } from "./features";
import { SecurityLogger } from "./security-log"
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
            Tools: ToolsManager;
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
    const Tools: ToolsManager;
}