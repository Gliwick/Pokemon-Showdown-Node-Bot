import { CommandParser as CommandParserClass } from './bll/command-parser';
import { DataDownloader as DataDownloaderClass } from './bll/data-downloader';
import { SecurityLogger } from './bll/security-log';
import { SettingsManager } from './bll/settings';
import { Client, ClientOptions } from './bll/showdown-client';
import { FormatData } from './bot-setup';
import { AppOptionsType, ConfigType } from './config-tools';
import { Feature } from './features';
import { Tools as ToolsType } from './tools';

declare global {
	namespace NodeJS {
		interface Global {
			AppOptions: AppOptionsType;
			Bot: Client;
			CommandParser: CommandParserClass;
			Config: ConfigType;
			DataDownloader: DataDownloaderClass;
			Features: Record<string, Feature>;
			Formats: Record<string, FormatData>;
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
	const Formats: Record<string, FormatData>;
	const PSClient: new (server: string, port: number, opts: Partial<ClientOptions>) => Client;
	const SecurityLog: SecurityLogger;
	const Settings: SettingsManager;
	const Tools: ToolsType;
}
