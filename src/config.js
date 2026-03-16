import { readFileSync, watch } from 'fs';
import { resolve } from 'path';

class ConfigManager {
  constructor() {
    this.configPath = process.env.CONFIG_PATH || '/app/config/sites.json';
    this.sites = new Map();
    this.loadConfig();
    this.watchConfig();
  }

  loadConfig() {
    try {
      const data = readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(data);
      this.sites = new Map(Object.entries(config));
      console.log(`Loaded configuration for ${this.sites.size} sites`);
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      if (this.sites.size === 0) {
        throw new Error('Configuration is required to start the service');
      }
    }
  }

  watchConfig() {
    try {
      watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          console.log('Configuration file changed, reloading...');
          try {
            this.loadConfig();
          } catch (error) {
            console.error('Failed to reload configuration:', error.message);
          }
        }
      });
      console.log('Watching configuration file for changes...');
    } catch (error) {
      console.warn('Could not watch configuration file:', error.message);
    }
  }

  getSite(siteId) {
    return this.sites.get(siteId);
  }

  hasSite(siteId) {
    return this.sites.has(siteId);
  }

  getAllowedOrigins(siteId) {
    const site = this.getSite(siteId);
    return site?.allowed_origins || [];
  }

  isOriginAllowed(siteId, origin) {
    const allowedOrigins = this.getAllowedOrigins(siteId);
    return allowedOrigins.includes(origin);
  }
}

export const configManager = new ConfigManager();
export default configManager;
