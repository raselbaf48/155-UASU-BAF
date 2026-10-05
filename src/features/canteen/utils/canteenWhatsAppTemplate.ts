import { getRankWeight, getCleanBdNo } from './canteenSeniority';
import { toBengaliNum, formatRankBn, formatMemberNameBn } from './exportCanteenBillExcel';
import { pushKeyToCloud, pullKeyFromCloud } from './canteenCloudSync';

export interface WhatsAppTemplateConfig {

  seniorTemplate: string;      // Individual Senior template
  juniorTemplate: string;      // Individual Junior template
  multipleTemplate: string;    // Multiple / Group template
  accountNo: string;
  accountName: string;
  bankBranch: string;
  managerTitle: string; // e.g. "ক্যান্টিন ম্যানেজার" or custom rank & name
}

export const DEFAULT_SENIOR_MSG_TEMPLATE = `আসসালামু আলাইকুম স্যার;
ক্যান্টিন বিলঃ {মাস}
মোট বিলঃ {মোট_বিল} টাকা
আপনার ক্যান্টিন বিল আগামী {পরের_মাসের_৫_তারিখ} তারিখের মধ্যে পরিশোধ করার জন্য অনুরোধ করা হলো।

Account No : {একাউন্ট_নম্বর}
{হিসাবধারীর_নাম}
United Commercial Bank Limited.
{শাখা}

বিদ্রঃ বিল পরিশোধ করে আমার Whatsapp এর ইনবক্সে Payment এর স্ক্রীনশট পাঠানোর অনুরোধ করা হল।

ধন্যবাদান্তে 
{ম্যানেজার}`;

export const DEFAULT_JUNIOR_MSG_TEMPLATE = `আসসালামু আলাইকুম;
ক্যান্টিন বিলঃ {মাস}
মোট বিলঃ {মোট_বিল} টাকা
আপনার ক্যান্টিন বিল আগামী {পরের_মাসের_৫_তারিখ} তারিখের মধ্যে পরিশোধ করার জন্য অনুরোধ করা হলো।

Account No : {একাউন্ট_নম্বর}
{হিসাবধারীর_নাম}
United Commercial Bank Limited.
{শাখা}

বিদ্রঃ বিল পরিশোধ করে আমার Whatsapp এর ইনবক্সে Payment এর স্ক্রীনশট পাঠানোর অনুরোধ করা হল।

ধন্যবাদান্তে 
{ম্যানেজার}`;

export const DEFAULT_MULTIPLE_MSG_TEMPLATE = `আসসালামু আলাইকুম স্যার/অল;
ক্যান্টিন বিলঃ {মাস}
যাদের ক্যান্টিন বিল বাকি আছে, তাদের বিল আগামী {পরের_মাসের_৫_তারিখ} তারিখের মধ্যে পরিশোধ করার জন্য অনুরোধ করা হলো।

Account No : {একাউন্ট_নম্বর}
{হিসাবধারীর_নাম}
United Commercial Bank Limited.
{শাখা}

বিদ্রঃ বিল পরিশোধ করে আমার Whatsapp এর ইনবক্সে Payment এর স্ক্রীনশট পাঠানোর অনুরোধ করা হল।

ধন্যবাদান্তে 
{ম্যানেজার}`;

export const DEFAULT_WHATSAPP_TEMPLATE_CONFIG: WhatsAppTemplateConfig = {
  seniorTemplate: DEFAULT_SENIOR_MSG_TEMPLATE,
  juniorTemplate: DEFAULT_JUNIOR_MSG_TEMPLATE,
  multipleTemplate: DEFAULT_MULTIPLE_MSG_TEMPLATE,
  accountNo: '',
  accountName: 'MD RASEL HOSSEN',
  bankBranch: 'Kathgor Brunch',
  managerTitle: 'ক্যান্টিন ম্যানেজার'
};

const STORAGE_KEY = 'canteen_whatsapp_template_config';

/**
 * Resolves Manager's display name into authentic Bengali (e.g. "LAC Nishad" -> "এলএসি নিশাদ")
 */
export function getManagerDisplayBangla(config?: WhatsAppTemplateConfig, managerName?: string): string {
  if (config?.managerTitle && config.managerTitle.trim() && config.managerTitle.trim() !== 'ক্যান্টিন ম্যানেজার') {
    return config.managerTitle.trim();
  }
  const nameToUse = (managerName || 'LAC Nishad').trim();
  if (/[\u0980-\u09FF]/.test(nameToUse)) {
    return nameToUse;
  }
  const parts = nameToUse.split(/\s+/);
  if (parts.length >= 2) {
    const rankPart = parts[0];
    const surnamePart = parts.slice(1).join(' ');
    const bnRank = formatRankBn(rankPart);
    const bnName = formatMemberNameBn(surnamePart);
    return `${bnRank} ${bnName}`.trim();
  } else if (parts.length === 1) {
    return formatMemberNameBn(parts[0]);
  }
  return 'ক্যান্টিন ম্যানেজার';
}

/**
 * Load WhatsApp Template Config from LocalStorage
 */
export function getWhatsAppTemplateConfig(): WhatsAppTemplateConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Auto-migrate older configs to include multipleTemplate and updated bank format
      if (!parsed.multipleTemplate) {
        parsed.multipleTemplate = DEFAULT_MULTIPLE_MSG_TEMPLATE;
      }
      if (parsed.seniorTemplate && parsed.seniorTemplate.includes('UCB Account No :')) {
        parsed.seniorTemplate = DEFAULT_SENIOR_MSG_TEMPLATE;
      }
      if (parsed.juniorTemplate && parsed.juniorTemplate.includes('UCB Account No :')) {
        parsed.juniorTemplate = DEFAULT_JUNIOR_MSG_TEMPLATE;
      }
      return {
        ...DEFAULT_WHATSAPP_TEMPLATE_CONFIG,
        ...parsed
      };
    }
  } catch (err) {
    console.warn('Error reading WhatsApp template config:', err);
  }
  return { ...DEFAULT_WHATSAPP_TEMPLATE_CONFIG };
}

/**
 * Save WhatsApp Template Config to LocalStorage and Cloud
 */
export function saveWhatsAppTemplateConfig(cfg: WhatsAppTemplateConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    pushKeyToCloud(STORAGE_KEY, cfg).catch(() => {});
    window.dispatchEvent(new CustomEvent('canteen_whatsapp_template_updated', { detail: cfg }));
  } catch (err) {
    console.warn('Error saving WhatsApp template config:', err);
  }
}

/**
 * Sync template config from cloud on load
 */
export async function syncWhatsAppTemplateConfigFromCloud(): Promise<WhatsAppTemplateConfig> {
  try {
    const cloudVal = await pullKeyFromCloud(STORAGE_KEY);
    if (cloudVal && typeof cloudVal === 'object') {
      const merged = { ...DEFAULT_WHATSAPP_TEMPLATE_CONFIG, ...cloudVal };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {}
  return getWhatsAppTemplateConfig();
}

/**
 * Format month in Bengali short year format e.g. "অক্টোবর ২৬"
 */
export function formatBengaliMonthShortYear(monthKey?: string): string {
  const bnMonths = [
    '', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  let y = new Date().getFullYear();
  let m = new Date().getMonth() + 1;

  if (monthKey && monthKey !== 'ALL') {
    const parts = String(monthKey).split('-');
    if (parts.length >= 2) {
      y = parseInt(parts[0], 10) || y;
      m = parseInt(parts[1], 10) || m;
    }
  }

  const mName = bnMonths[m] || 'চলতি মাস';
  const shortYear = String(y).slice(-2);
  return `${mName} ${toBengaliNum(shortYear)}`;
}

/**
 * Calculate the 5th of the following month in Bengali, e.g. "৫ নভেম্বর ২৬"
 */
export function getBengaliNextMonthDueDate(monthKey?: string): string {
  const bnMonths = [
    '', 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  let y = new Date().getFullYear();
  let m = new Date().getMonth() + 1;

  if (monthKey && monthKey !== 'ALL') {
    const parts = String(monthKey).split('-');
    if (parts.length >= 2) {
      y = parseInt(parts[0], 10) || y;
      m = parseInt(parts[1], 10) || m;
    }
  }

  // Calculate next month
  let nextM = m + 1;
  let nextY = y;
  if (nextM > 12) {
    nextM = 1;
    nextY += 1;
  }

  const nextMName = bnMonths[nextM] || '';
  const shortYear = String(nextY).slice(-2);
  return `৫ ${nextMName} ${toBengaliNum(shortYear)}`;
}

/**
 * Check if a member is senior to the canteen manager based on BAF military rank and BD No
 */
export function isMemberSeniorToManager(
  member: any, 
  managerName?: string, 
  managerBdNo?: string,
  managerRank?: string
): boolean {
  if (!member) return false;

  const memberRank = member.Rank || member.rank || '';
  const memberWeight = getRankWeight(memberRank);

  // Determine manager rank
  let mgrRankStr = managerRank || '';
  if (!mgrRankStr && managerName) {
    // Attempt to extract rank from managerName, e.g. "LAC Nishad", "Cpl Rasel", "Sgt ..."
    const words = managerName.trim().split(/\s+/);
    if (words.length > 0) {
      mgrRankStr = words[0];
    }
  }
  // Default manager rank if not found: 'LAC'
  if (!mgrRankStr) mgrRankStr = 'LAC';

  const mgrWeight = getRankWeight(mgrRankStr);

  // Lower rank weight = HIGHER seniority
  if (memberWeight < mgrWeight) {
    return true; // Member is strictly higher in rank (e.g. Officer or Sgt vs LAC)
  }

  if (memberWeight > mgrWeight) {
    return false; // Member is strictly lower in rank (e.g. AC-1 vs LAC)
  }

  // Same rank: lower BD number is senior
  const memberBdClean = parseInt(getCleanBdNo(member['BD No'] || member.bdNo || member.airman_id), 10);
  const mgrBdClean = parseInt(getCleanBdNo(managerBdNo || ''), 10);

  if (!isNaN(memberBdClean) && !isNaN(mgrBdClean) && memberBdClean > 0 && mgrBdClean > 0) {
    return memberBdClean < mgrBdClean;
  }

  return false;
}

/**
 * Build the final WhatsApp message string based on Seniority and Template Config (Individual Member)
 */
export function buildWhatsAppBillMessage(params: {
  member: any;
  totalDue: number;
  monthKey?: string;
  config?: WhatsAppTemplateConfig;
  managerName?: string;
  managerRank?: string;
  managerBdNo?: string;
  rankBn?: string;
  nameBn?: string;
}): { message: string; isSenior: boolean } {
  const {
    member,
    totalDue,
    monthKey,
    config = getWhatsAppTemplateConfig(),
    managerName = 'LAC Nishad',
    managerRank,
    managerBdNo,
    rankBn = '',
    nameBn = ''
  } = params;

  const isSenior = isMemberSeniorToManager(member, managerName, managerBdNo, managerRank);
  const rawTemplate = isSenior ? config.seniorTemplate : config.juniorTemplate;

  const monthShort = formatBengaliMonthShortYear(monthKey);
  const dueDate = getBengaliNextMonthDueDate(monthKey);
  const formattedBill = toBengaliNum(Math.round(totalDue));
  const effectiveManager = getManagerDisplayBangla(config, managerName);

  // Replace placeholders
  let msg = rawTemplate
    .replace(/\{মাস\}/g, monthShort)
    .replace(/\{মোট_বিল\}/g, formattedBill)
    .replace(/\{পরের_মাসের_৫_তারিখ\}/g, dueDate)
    .replace(/\{একাউন্ট_নম্বর\}/g, config.accountNo ? config.accountNo.trim() : '')
    .replace(/\{হিসাবধারীর_নাম\}/g, config.accountName || 'MD RASEL HOSSEN')
    .replace(/\{শাখা\}/g, config.bankBranch || 'Kathgor Brunch')
    .replace(/\{ম্যানেজার\}/g, effectiveManager)
    .replace(/\{মেম্বার_র্যাংক\}/g, rankBn || member.Rank || member.rank || '')
    .replace(/\{মেম্বার_নাম\}/g, nameBn || member.Surname || member.surname || '');

  return { message: msg, isSenior };
}

/**
 * Build Multiple / Group WhatsApp Bill Announcement message (e.g. for Print Preview sharing)
 */
export function buildWhatsAppMultipleBillMessage(params: {
  monthKey?: string;
  config?: WhatsAppTemplateConfig;
  managerName?: string;
}): string {
  const {
    monthKey,
    config = getWhatsAppTemplateConfig(),
    managerName = 'LAC Nishad'
  } = params;

  const rawTemplate = config.multipleTemplate || DEFAULT_MULTIPLE_MSG_TEMPLATE;
  const monthShort = formatBengaliMonthShortYear(monthKey);
  const dueDate = getBengaliNextMonthDueDate(monthKey);
  const effectiveManager = getManagerDisplayBangla(config, managerName);

  return rawTemplate
    .replace(/\{মাস\}/g, monthShort)
    .replace(/\{পরের_মাসের_৫_তারিখ\}/g, dueDate)
    .replace(/\{একাউন্ট_নম্বর\}/g, config.accountNo ? config.accountNo.trim() : '')
    .replace(/\{হিসাবধারীর_নাম\}/g, config.accountName || 'MD RASEL HOSSEN')
    .replace(/\{শাখা\}/g, config.bankBranch || 'Kathgor Brunch')
    .replace(/\{ম্যানেজার\}/g, effectiveManager);
}

