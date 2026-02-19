declare module "auto-launch" {
  type AutoLaunchOptions = {
    name: string;
    path?: string;
    isHidden?: boolean;
    mac?: { useLaunchAgent?: boolean };
  };

  export default class AutoLaunch {
    constructor(options: AutoLaunchOptions);
    isEnabled(): Promise<boolean>;
    enable(): Promise<void>;
    disable(): Promise<void>;
  }
}
