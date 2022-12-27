import { CommandParser as CommandParserClass } from './command-parser';
import { AppOptionsType, ConfigType } from './config-tools';
import { DataDownloader as DataDownloaderClass } from './data-downloader';
import { Feature } from './features';
import { FormatData } from './index';
import { SecurityLogger } from './security-log';
import { FlatFileManager as FlatFileManagerClass, SettingsManager } from './settings';
import { Client, ClientOptions } from './showdown-client';
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
			FlatFileManager: new () => FlatFileManagerClass;
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
	let Features: Record<string, Feature>;
	const FlatFileManager: new () => FlatFileManagerClass;
	const Formats: Record<string, FormatData>;
	const PSClient: new (server: string, port: number, opts: Partial<ClientOptions>) => Client;
	const SecurityLog: SecurityLogger;
	const Settings: SettingsManager;
	const Tools: ToolsType;
}
