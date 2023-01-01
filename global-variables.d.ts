import { DataDownloader as DataDownloaderClass } from './bll/data-downloader';
import { SecurityLogger } from './bll/security-log';
import { SettingsManager } from './bll/settings';
import { Client, ClientOptions } from './bll/showdown-client';
import { FormatData } from './bot-setup';
import { CommandParser as CommandParserClass } from './command-parser';
import { ConfigType } from './config-tools';
import { FeatureManager } from './features';
import { GlobalMonitor as GlobalMonitorClass } from './global-monitor';
import { AppOptionsType } from './global-types';
import { Tools as ToolsType } from './tools';

export declare global {
	namespace NodeJS {
		interface Global {
			AppOptions: AppOptionsType;
			Bot: Client;
			CommandParser: CommandParserClass;
			Config: ConfigType;
			DataDownloader: DataDownloaderClass;
			Features: FeatureManager;
			Formats: Record<string, FormatData>;
			GlobalMonitor: GlobalMonitorClass;
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
	const Features: FeatureManager;
	const Formats: Record<string, FormatData>;
	const GlobalMonitor: GlobalMonitorClass;
	const PSClient: new (server: string, port: number, opts: Partial<ClientOptions>) => Client;
	const SecurityLog: SecurityLogger;
	const Settings: SettingsManager;
	const Tools: ToolsType;
}
