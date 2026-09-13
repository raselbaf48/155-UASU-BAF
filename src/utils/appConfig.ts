export interface AppNotice {
  isActive: boolean;
  heading?: string;
  message: string;
  isScheduled: boolean;
  startTime?: string;
  endTime?: string;
}

export interface AppMaintenance {
  isActive: boolean;
  message: string;
  isScheduled: boolean;
  startTime?: string;
  endTime?: string;
}

export interface AppConfig {
  notice: AppNotice;
  maintenance: AppMaintenance;
}

export interface AppConfigHistoryItem {
  id: string;
  type: 'NOTICE' | 'MAINTENANCE';
  heading?: string;
  message: string;
  startTime?: string;
  endTime?: string;
  createdAt: string;
  isActive?: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  notice: {
    isActive: false,
    heading: 'Important Notice',
    message: '',
    isScheduled: false,
  },
  maintenance: {
    isActive: false,
    message: 'App is currently undergoing maintenance. Please try again later.',
    isScheduled: false,
  }
};

export const getAppConfig = (): AppConfig => {
  try {
    const saved = localStorage.getItem('baf_app_config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (err) {
    console.error('Error reading app config:', err);
  }
  return DEFAULT_CONFIG;
};

export const saveAppConfig = (config: AppConfig) => {
  localStorage.setItem('baf_app_config', JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('baf_app_config_changed', { detail: config }));
};

export const isFeatureActive = (feature: AppNotice | AppMaintenance): boolean => {
  if (!feature.isActive) return false;
  if (feature.isScheduled) {
    const now = new Date();
    if (feature.startTime && feature.endTime) {
      const start = new Date(feature.startTime);
      const end = new Date(feature.endTime);
      return now >= start && now <= end;
    }
  }
  return true;
};

export const getAppConfigHistory = (): AppConfigHistoryItem[] => {
  try {
    const saved = localStorage.getItem('baf_app_config_history');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error('Error reading app config history:', err);
  }
  return [];
};

export const addAppConfigHistory = (item: Omit<AppConfigHistoryItem, 'id' | 'createdAt'>) => {
  const history = getAppConfigHistory();
  const newItem: AppConfigHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString()
  };
  const updated = [newItem, ...history].slice(0, 100); // Keep last 100 items
  localStorage.setItem('baf_app_config_history', JSON.stringify(updated));
  return updated;
};

export const clearAppConfigHistory = () => {
  localStorage.removeItem('baf_app_config_history');
};

export const updateAppConfigHistoryItemActiveStatus = (id: string, isActive: boolean) => {
  const history = getAppConfigHistory();
  const updated = history.map(item => item.id === id ? { ...item, isActive } : item);
  localStorage.setItem('baf_app_config_history', JSON.stringify(updated));
  return updated;
};

export const deleteAppConfigHistoryItem = (id: string) => {
  const history = getAppConfigHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem('baf_app_config_history', JSON.stringify(updated));
  return updated;
};
