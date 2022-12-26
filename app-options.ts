/* Process arguments */

export interface AppOptionsType {
    help?: boolean;
    debugmode?: number;
    testmode?: boolean;
    config?: string;
    data?: string;
};

export function parseArguments(arr: string[]): AppOptionsType {
    const opts: AppOptionsType = {};
    let arg = '';
    for (let i = 0; i < arr.length; i++) {
        arg = arr[i].toLowerCase().trim();
        if (arg.charAt(0) === '-') {
            switch (arg) {
                case '-h':
                case '-help':
                    opts.help = true;
                    break;
                case '-production':
                case '-p':
                    opts.debugmode = 3;
                    break;
                case '-monitor':
                case '-m':
                    opts.debugmode = 2;
                    break;
                case '-debug':
                case '-d':
                    opts.debugmode = 1;
                    break;
                case '-test':
                case '-t':
                    opts.testmode = true;
                    break;
                case '-c':
                case '-config':
                    if (!arr[i + 1]) opts.help = true;
                    opts.config = arr[i + 1];
                    i++;
                    break;
                case '-dt':
                case '-data':
                    if (!arr[i + 1]) opts.help = true;
                    opts.data = arr[i + 1];
                    i++;
                    break;
                default:
                    console.log('unknown parametter: ' + arg);
                    opts.help = true;
            }
        }
    }
    return opts;
};