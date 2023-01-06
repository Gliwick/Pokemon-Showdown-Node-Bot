import { FormatData } from './bot-setup';
import { CommandParser as CommandParserClass } from './command-parser';
import { ConfigType } from './config-tools';
import { DataDownloader as DataDownloaderClass } from './data-downloader';
import { FeatureManager } from './features';
import { GlobalMonitor as GlobalMonitorClass } from './global-monitor';
import { AppOptionsType } from './global-types';
import { LanguagesRepo } from './languages';
import { SecurityLogger } from './security-log';
import { SettingsManager } from './settings';
import { Client } from './showdown-client';

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
			Languages: LanguagesRepo;
			SecurityLog: SecurityLogger;
			Settings: SettingsManager;
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
	const Languages: LanguagesRepo;
	const SecurityLog: SecurityLogger;
	const Settings: SettingsManager;
}
