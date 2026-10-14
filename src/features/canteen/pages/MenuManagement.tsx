import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Coffee, Plus, Calendar, X, Utensils, Edit2 } from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, getItemDisplayName } from '../utils/canteenSettings';
import { queuePushKeyToCloud, pushKeyToCloud } from '../utils/canteenCloudSync';
import { getCanteenMenuCache, fetchCanteenMenuOnce, setCanteenMenuCache, updateSingleMenuItemInCache, isOneTimeBoxItem, normalizeCatalogKey, deduplicateCanteenMenuItems, saveUserMenuOverride, getUserMenuOverrides } from '../utils/canteenMenuData';
import { calculateMenuItemStockInfo, getRawInventoryItems, getMenuRecipes } from '../utils/recipeManager';
import { getMenuItemBanglaName, saveMenuItemBanglaName, getMenuBanglaNamesMap } from '../utils/menuBanglaNames';
import { sortCanteenMenuItems } from '../utils/menuOrdering';

export const MenuManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const [items, setItems] = useState<any[]>(() => {
    try {
      const cached = getCanteenMenuCache();
      if (cached && cached.length > 0) {
        const mapped = cached
          .filter((d: any) => !isOneTimeBoxItem(d))
          .map((d: any) => {
            const bn = d.name_bn || d['Name (BN)'] || d.nameBn || getMenuItemBanglaName(d) || d.name;
            const en = d.name || d.name_en || '';
            return {
              ...d,
              id: d.id,
              meal: d.category || d.meal || 'Snacks',
              category: d.category || d.meal || 'Snacks',
              name_bn: bn,
              nameBn: bn,
              'Name (BN)': bn,
              name_en: en,
              name: en,
              price: Number(d.price || 0),
              max: Number(d.stock ?? d.max ?? 50),
              stock: Number(d.stock ?? d.max ?? 50),
              DP: d.DP || d.img || d.image || ''
            };
          });
        return sortCanteenMenuItems(mapped);
      }
    } catch {}
    return [];
  });

  const loadMenuData = () => {
    try {
      const cached = getCanteenMenuCache();
      if (cached && cached.length > 0) {
        const mapped = cached
          .filter((d: any) => !isOneTimeBoxItem(d))
          .map((d: any) => {
            const bn = d.name_bn || d['Name (BN)'] || d.nameBn || getMenuItemBanglaName(d) || d.name;
            const en = d.name || d.name_en || '';
            return {
              ...d,
              id: d.id,
              meal: d.category || d.meal || 'Snacks',
              category: d.category || d.meal || 'Snacks',
              name_bn: bn,
              nameBn: bn,
              'Name (BN)': bn,
              name_en: en,
              name: en,
              price: Number(d.price || 0),
              max: Number(d.stock ?? d.max ?? 50),
              stock: Number(d.stock ?? d.max ?? 50),
              DP: d.DP || d.img || d.image || ''
            };
          });
        setItems(sortCanteenMenuItems(mapped));
      }
    } catch (e) {
      console.warn('Error loading menu data in MenuManagement:', e);
    }
  };

  useEffect(() => {
    const fetchCloudMenu = async () => {
      try {
        const data = await fetchCanteenMenuOnce();
        if (data && data.length > 0) {
          const mapped = data
            .filter((d: any) => !isOneTimeBoxItem(d))
            .map((d: any) => {
              const bn = d.name_bn || d['Name (BN)'] || d.nameBn || getMenuItemBanglaName(d) || d.name;
              const en = d.name || d.name_en || '';
              return {
                ...d,
                id: d.id,
                meal: d.category || d.meal || 'Snacks',
                category: d.category || d.meal || 'Snacks',
                name_bn: bn,
                nameBn: bn,
                'Name (BN)': bn,
                name_en: en,
                name: en,
                price: Number(d.price || 0),
                max: Number(d.stock ?? d.max ?? 50),
                stock: Number(d.stock ?? d.max ?? 50),
                DP: d.DP || d.img || d.image || ''
              };
            });
          const sorted = sortCanteenMenuItems(mapped);
          setItems(sorted);
          localStorage.setItem('canteen_menu_items_list', JSON.stringify(sorted));
        }
      } catch (e) {
        console.warn('Could not fetch cloud menu in MenuManagement:', e);
      }
    };
    fetchCloudMenu();

    const handleMenuUpdated = () => {
      loadMenuData();
    };
    window.addEventListener('canteen_menu_updated', handleMenuUpdated);
    window.addEventListener('canteen_state_updated', handleMenuUpdated);
    return () => {
      window.removeEventListener('canteen_menu_updated', handleMenuUpdated);
      window.removeEventListener('canteen_state_updated', handleMenuUpdated);
    };
  }, []);

  const [rawInventory, setRawInventory] = useState<any[]>(() => getRawInventoryItems());
  const [recipesMap, setRecipesMap] = useState<any>(() => getMenuRecipes());

  useEffect(() => {
    const handleSync = () => {
      setRawInventory(getRawInventoryItems());
      setRecipesMap(getMenuRecipes());
    };
    window.addEventListener('canteen_raw_inventory_updated', handleSync);
    window.addEventListener('canteen_menu_recipes_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('canteen_raw_inventory_updated', handleSync);
      window.removeEventListener('canteen_menu_recipes_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name_bn: '', name_en: '', price: '', max: '', DP: '' });

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name_bn: '', name_en: '', price: '', max: '50', DP: '' });
    setShowAdd(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      name_bn: item.name_bn || item['Name (BN)'] || getMenuItemBanglaName(item) || '',
      name_en: item.name_en || item.name || '',
      price: String(item.price ?? ''),
      max: String(item.max ?? item.stock ?? '50'),
      DP: item.DP || item.img || item.image || ''
    });
    setShowAdd(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = Number(formData.price || 0);
    const maxNum = Number(formData.max || 50);
    const nameBn = formData.name_bn.trim();
    const nameEn = formData.name_en.trim() || nameBn;
    const dpTrimmed = formData.DP.trim();

    if (editingItem) {
      // Editing Existing Menu Item
      const oldPrice = Number(editingItem.price || 0);
      const oldNameEn = String(editingItem.name_en || editingItem.name || '').trim();
      const oldNameBn = String(editingItem.name_bn || '').trim();
      const nowIso = new Date().toISOString();

      const updatedItem = {
        ...editingItem,
        name_bn: nameBn,
        nameBn: nameBn,
        'Name (BN)': nameBn,
        name_en: nameEn,
        name: nameEn,
        price: priceNum,
        max: maxNum,
        stock: maxNum,
        DP: dpTrimmed,
        img: dpTrimmed,
        image: dpTrimmed,
        updated_at: nowIso
      };

      // 1. Immediately persist user override & Bangla name FIRST so cache deduplication respects them
      saveMenuItemBanglaName({ id: editingItem.id, name: nameEn, oldName: oldNameEn }, nameBn);
      saveUserMenuOverride({
        ...updatedItem,
        oldNameEn,
        oldNameBn
      } as any);

      // 2. Synchronize item array and caches
      const updated = items.map(item => item.id === editingItem.id ? updatedItem : item);
      setItems(updated);
      updateSingleMenuItemInCache(updatedItem);
      localStorage.setItem('canteen_menu_items_list', JSON.stringify(updated));
      localStorage.setItem('canteen_menu_cache', JSON.stringify(updated));
      localStorage.setItem('canteen_menu_items_catalog_v1', JSON.stringify(updated));
      setCanteenMenuCache(updated);

      // Recalculate and update past transactions in canteen_txs in real-time
      try {
        const rawTxs = localStorage.getItem('canteen_txs');
        if (rawTxs) {
          const txs = JSON.parse(rawTxs);
          let txsChanged = false;
          const updatedTxs = txs.map((tx: any) => {
            let hasItem = false;
            let newSoldItems = tx.soldItems;

            if (Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
              newSoldItems = tx.soldItems.map((si: any) => {
                const matchesId = String(si.menuItemId || si.id) === String(editingItem.id);
                const normSi = normalizeCatalogKey(si.menuItemName || si.name || '');
                const matchesName = (normSi && (
                  normSi === normalizeCatalogKey(oldNameEn) ||
                  normSi === normalizeCatalogKey(nameEn) ||
                  normSi === normalizeCatalogKey(oldNameBn) ||
                  normSi === normalizeCatalogKey(nameBn) ||
                  normSi.includes(normalizeCatalogKey(nameEn)) ||
                  normSi.includes(normalizeCatalogKey(nameBn))
                ));

                if (matchesId || matchesName) {
                  hasItem = true;
                  txsChanged = true;
                  return {
                    ...si,
                    menuItemId: editingItem.id,
                    menuItemName: nameBn || nameEn,
                    price: priceNum
                  };
                }
                return si;
              });

              if (hasItem) {
                const totalGross = newSoldItems.reduce(
                  (sum: number, si: any) => sum + (Number(si.price || 0) * Number(si.qty || si.quantity || 1)),
                  0
                );
                const discount = Number(tx.discount || 0);
                const newAmount = Math.max(0, totalGross - discount);
                return {
                  ...tx,
                  soldItems: newSoldItems,
                  items: newSoldItems.map((si: any) => `${si.menuItemName} (${si.qty || 1})`).join(', '),
                  originalAmount: totalGross,
                  amount: newAmount
                };
              }
            } else if (tx.items && typeof tx.items === 'string') {
              const normItems = normalizeCatalogKey(tx.items);
              const isMatch = normItems.includes(normalizeCatalogKey(oldNameEn)) ||
                normItems.includes(normalizeCatalogKey(nameEn)) ||
                normItems.includes(normalizeCatalogKey(oldNameBn)) ||
                normItems.includes(normalizeCatalogKey(nameBn));
              if (isMatch) {
                const parts = tx.items.split(',').map((s: string) => s.trim()).filter(Boolean);
                let liveSum = 0;
                let matched = false;
                for (const part of parts) {
                  const match = part.match(/^(.+?)\s*\(([0-9]+)\)$/);
                  if (match) {
                    const nm = match[1].trim();
                    const q = parseInt(match[2], 10) || 1;
                    const normPart = normalizeCatalogKey(nm);
                    if (
                      normPart === normalizeCatalogKey(oldNameEn) || 
                      normPart === normalizeCatalogKey(nameEn) || 
                      normPart === normalizeCatalogKey(oldNameBn) || 
                      normPart === normalizeCatalogKey(nameBn)
                    ) {
                      liveSum += priceNum * q;
                      matched = true;
                    }
                  }
                }
                if (matched && liveSum > 0) {
                  txsChanged = true;
                  const discount = Number(tx.discount || 0);
                  return {
                    ...tx,
                    originalAmount: liveSum,
                    amount: Math.max(0, liveSum - discount)
                  };
                }
              }
            }
            return tx;
          });

          if (txsChanged) {
            localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
            queuePushKeyToCloud('canteen_txs');
            window.dispatchEvent(new Event('canteen_txs_updated'));
          }
        }
      } catch (err) {
        console.warn('Error updating past txs on menu price change:', err);
      }

      // Sync updated menu item to Cloud & Supabase immediately (0ms)
      queuePushKeyToCloud('canteen_daily_menu');
      pushKeyToCloud('canteen_user_menu_overrides', getUserMenuOverrides()).catch(() => {});
      pushKeyToCloud('canteen_menu_bangla_names', getMenuBanglaNamesMap()).catch(() => {});
      pushKeyToCloud('canteen_menu_items_catalog_v1', updated).catch(() => {});

      // Direct update in Supabase Canteen_Menu table by ID and name fallback
      const dbPayload: any = {
        name: nameEn,
        name_bn: nameBn,
        price: priceNum,
        stock: maxNum,
        DP: dpTrimmed || null,
        category: editingItem.meal || editingItem.category || 'SNACKS',
        updated_at: nowIso
      };

      try {
        let rowUpdated = false;
        // 1. Try update by exact ID
        const { data: idUpd, error: updateErr } = await supabase
          .from('Canteen_Menu')
          .update(dbPayload)
          .eq('id', editingItem.id)
          .select();

        if (!updateErr && idUpd && idUpd.length > 0) {
          rowUpdated = true;
        } else if (oldNameEn || oldNameBn) {
          // 2. Fallback update by old English or Bengali name
          if (oldNameEn) {
            const { data: nameUpd } = await supabase
              .from('Canteen_Menu')
              .update(dbPayload)
              .ilike('name', oldNameEn)
              .select();
            if (nameUpd && nameUpd.length > 0) rowUpdated = true;
          }
          if (!rowUpdated && oldNameBn) {
            const { data: bnUpd } = await supabase
              .from('Canteen_Menu')
              .update(dbPayload)
              .eq('name_bn', oldNameBn)
              .select();
            if (bnUpd && bnUpd.length > 0) rowUpdated = true;
          }
        }

        // 3. If no row updated, perform upsert to guarantee persistence
        if (!rowUpdated) {
          await supabase.from('Canteen_Menu').upsert({ id: editingItem.id, ...dbPayload }, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Canteen_Menu update note, fallback to upsert:', err);
        try {
          await supabase.from('Canteen_Menu').upsert({ id: editingItem.id, ...dbPayload }, { onConflict: 'id' });
        } catch {}
      }

      // Instant global real-time notifications
      window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('canteen_daily_menu_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

    } else {
      // Prevent duplicate menu addition
      const normEn = normalizeCatalogKey(nameEn);
      const normBn = normalizeCatalogKey(nameBn);
      const duplicate = items.find(it => {
        const itEn = normalizeCatalogKey(it.name_en || (it as any).name || '');
        const itBn = normalizeCatalogKey(it.name_bn || (it as any).nameBn || '');
        return (normEn && itEn && normEn === itEn) ||
               (normBn && itBn && normBn === itBn);
      });
      if (duplicate) {
        alert(`"${nameEn || nameBn}" মেনুতে ইতিমধ্যে রয়েছে! একই আইটেম ডাবল যোগ করা যাবে না।`);
        return;
      }

      // Adding New Menu (generates compliant UUID for Supabase and local storage)
      const newGeneratedId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : 'item-' + Date.now();

      const newItem = {
        id: newGeneratedId,
        meal: 'SNACKS',
        category: 'SNACKS',
        name_bn: nameBn,
        nameBn: nameBn,
        'Name (BN)': nameBn,
        name_en: nameEn,
        name: nameEn,
        price: priceNum,
        max: maxNum,
        stock: maxNum,
        DP: dpTrimmed,
        img: dpTrimmed,
        image: dpTrimmed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const updated = deduplicateCanteenMenuItems([...items, newItem]);
      setItems(updated);
      localStorage.setItem('canteen_menu_items_list', JSON.stringify(updated));
      localStorage.setItem('canteen_menu_cache', JSON.stringify(updated));
      localStorage.setItem('canteen_menu_items_catalog_v1', JSON.stringify(updated));
      setCanteenMenuCache(updated);
      saveMenuItemBanglaName({ id: newItem.id, name: nameEn }, nameBn);
      saveUserMenuOverride({
        id: newItem.id,
        name: nameEn,
        name_en: nameEn,
        name_bn: nameBn,
        nameBn: nameBn,
        'Name (BN)': nameBn,
        price: priceNum,
        stock: maxNum,
        max: maxNum,
        DP: dpTrimmed
      });

      // Cloud sync immediately (0ms)
      queuePushKeyToCloud('canteen_daily_menu');
      pushKeyToCloud('canteen_menu_items_catalog_v1', updated);
      pushKeyToCloud('canteen_user_menu_overrides', getUserMenuOverrides());
      pushKeyToCloud('canteen_menu_bangla_names', getMenuBanglaNamesMap());

      const isNewUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(newItem.id);
      const insertPayload: any = {
        name: newItem.name_en,
        name_bn: newItem.name_bn,
        price: newItem.price,
        stock: newItem.max,
        DP: newItem.DP,
        category: 'SNACKS',
        created_at: newItem.created_at,
        updated_at: new Date().toISOString()
      };
      if (isNewUuid) insertPayload.id = newItem.id;

      Promise.resolve(supabase.from('Canteen_Menu').insert([insertPayload]).select())
      .then(({ data, error }) => {
        if (error) {
          console.warn('Canteen_Menu insert note:', error.message);
        } else if (data && data[0] && data[0].id && !isNewUuid) {
          // If server assigned a UUID, update local record ID
          const realId = data[0].id;
          const remapped = updated.map(u => u.id === newItem.id ? { ...u, id: realId } : u);
          setItems(remapped);
          setCanteenMenuCache(remapped);
        }
      })
      .catch(err => console.warn('Canteen_Menu insert network note:', err));

      // Instant global real-time notifications
      window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('canteen_daily_menu_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
    }

    setShowAdd(false);
    setEditingItem(null);
    setFormData({ name_bn: '', name_en: '', price: '', max: '', DP: '' });
  };

  const handleDelete = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    localStorage.setItem('canteen_menu_items_list', JSON.stringify(updated));
    setCanteenMenuCache(updated);
    queuePushKeyToCloud('canteen_daily_menu');
    supabase.from('Canteen_Menu').delete().eq('id', id).then(() => {});

    window.dispatchEvent(new CustomEvent('canteen_menu_updated', { detail: updated }));
    window.dispatchEvent(new Event('canteen_inventory_updated'));
    window.dispatchEvent(new Event('canteen_daily_menu_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white dark:text-white flex items-center space-x-2">
           <Coffee className="w-6 h-6 text-emerald-500" />
           <span>{t('menu_management')}</span>
        </h2>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="date" className="pl-9 pr-4 py-2 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-48 font-medium text-slate-300" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <button className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-sm">
            <span>{t('publish_menu')}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 dark:border-slate-800 bg-slate-800 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-200 dark:text-slate-300">আজকের মেনু তালিকা ({items.length}টি)</h3>
            <button 
              type="button"
              onClick={openAddModal} 
              className="text-emerald-400 hover:bg-emerald-900/30 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black transition-colors flex items-center space-x-1.5 border border-emerald-500/30 bg-emerald-950/40 cursor-pointer shadow-sm"
            >
                <Plus className="w-4 h-4" />
                <span>Add New Menu</span>
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed sm:table-auto">
            <thead className="bg-slate-800 dark:bg-slate-800/50 text-slate-400 font-medium border-b border-slate-800 dark:border-slate-800">
              <tr>
                <th className="w-16 px-3 py-3.5 text-center shrink-0">DP</th>
                <th className="w-28 px-3 py-3.5 text-left shrink-0">Meal Type</th>
                <th className="w-auto px-4 py-3.5">{t('item')}</th>
                <th className="w-24 px-3 py-3.5 text-right shrink-0">{t('price')}</th>
                <th className="w-32 px-3 py-3.5 text-center shrink-0">Live Stock</th>
                <th className="w-28 px-3 py-3.5 text-right shrink-0">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-200 dark:text-slate-300">
              {items.map((row) => {
                  const itemDp = resolveImageUrl(row.DP || row.img || row.image);
                  const banglaName = row.name_bn || row['Name (BN)'] || row.nameBn || getItemDisplayName(row, 'menu').primary;
                  const englishName = row.name_en || row.name || '';
                  const itemLimit = row.stock !== undefined ? Number(row.stock) : (row.max !== undefined ? Number(row.max) : undefined);
                  const stockInfo = calculateMenuItemStockInfo(row.id, englishName || banglaName, rawInventory, recipesMap, itemLimit);
                  return (
                  <tr key={row.id} className="hover:bg-slate-800 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="w-16 px-3 py-2.5 text-center shrink-0">
                        <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                          {itemDp ? (
                            <img src={itemDp} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <Utensils className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                     </td>
                     <td className="w-28 px-3 py-3 font-bold text-slate-400 text-xs uppercase tracking-wider shrink-0 whitespace-nowrap">{row.meal || 'Snacks'}</td>
                     <td className="w-auto px-4 py-3">
                        <div className="font-bold text-slate-100 text-sm">{banglaName}</div>
                        {englishName && englishName.trim().toLowerCase() !== banglaName.trim().toLowerCase() && (
                          <div className="text-[11px] text-slate-400 font-mono tracking-tight">{englishName}</div>
                        )}
                     </td>
                     <td className="w-24 px-3 py-3 text-right font-bold text-emerald-400 font-mono shrink-0 whitespace-nowrap">৳{row.price}</td>
                     <td className="w-32 px-3 py-3 text-center shrink-0 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black font-mono tracking-wider shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_3px_5px_-1px_rgba(0,0,0,0.6)] border-b-2 ${
                            stockInfo.availableStock < 5 
                              ? 'bg-gradient-to-b from-rose-500 to-rose-800 text-white border-rose-400 border-b-rose-950 shadow-[0_3px_10px_rgba(244,63,94,0.45)]' 
                              : 'bg-gradient-to-b from-emerald-600 to-emerald-900 text-white border-emerald-400 border-b-emerald-950 shadow-[0_3px_8px_rgba(16,185,129,0.35)]'
                        }`}>
                           <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stockInfo.availableStock < 5 ? 'bg-white animate-ping' : 'bg-emerald-300'}`} />
                           <span>Stock: {stockInfo.availableStock}</span>
                           {stockInfo.availableStock <= 0 && (
                              <span className="ml-1 text-[9px] px-1 rounded bg-black/50 text-rose-200 font-bold">
                                 শেষ
                              </span>
                           )}
                        </div>
                     </td>
                     <td className="w-28 px-3 py-3 text-right shrink-0 whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          <button 
                            type="button"
                            onClick={() => openEditModal(row)} 
                            className="text-indigo-400 hover:text-indigo-300 font-bold text-xs bg-indigo-950/50 hover:bg-indigo-900/40 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                          >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDelete(row.id)} 
                            className="text-rose-400 hover:text-rose-300 font-bold text-xs bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                              {t('cancel')}
                          </button>
                        </div>
                     </td>
                  </tr>
                  );
              })}
              {items.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                        <Utensils className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">
                          {editingItem ? 'মেনু সম্পাদনা করুন (Edit Menu)' : 'নতুন মেনু যোগ করুন (Add New Menu)'}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {editingItem ? 'Update menu price and name in realtime' : 'Add to menu catalog across the system'}
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => { setShowAdd(false); setEditingItem(null); }} 
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-5 h-5"/>
                    </button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">Name (Bangla) - বাংলা নাম</label>
                        <input required type="text" value={formData.name_bn ?? ""} onChange={e => setFormData({...formData, name_bn: e.target.value})} className="w-full px-4 py-2.5 border border-slate-700 bg-slate-950 text-white font-medium rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm" placeholder="যেমন: সিঙ্গারা / ডিম পোচ" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">Name (English) - ইংরেজি নাম</label>
                        <input required type="text" value={formData.name_en ?? ""} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full px-4 py-2.5 border border-slate-700 bg-slate-950 text-white font-medium rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm" placeholder="e.g. Singara / Egg Poach" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-200 mb-1">Price (৳) - বিক্রয় মূল্য</label>
                            <input required type="number" min="0" step="any" value={formData.price ?? ""} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2.5 border border-slate-700 bg-slate-950 text-emerald-400 font-mono font-bold rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm" placeholder="15" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-200 mb-1">Max / Stock - স্টক সংখ্যা</label>
                            <input required type="number" min="0" value={formData.max ?? ""} onChange={e => setFormData({...formData, max: e.target.value})} className="w-full px-4 py-2.5 border border-slate-700 bg-slate-950 text-white font-mono font-bold rounded-xl outline-none focus:border-emerald-500 text-xs sm:text-sm" placeholder="50" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-200 mb-1">Photo / DP URL (ঐচ্ছিক ছবি লিঙ্ক)</label>
                        <input type="text" value={formData.DP ?? ""} onChange={e => setFormData({...formData, DP: e.target.value})} className="w-full px-4 py-2.5 border border-slate-700 bg-slate-950 text-white rounded-xl outline-none focus:border-emerald-500 text-xs font-mono" placeholder="https://..." />
                    </div>
                    <div className="pt-3">
                        <button 
                          type="submit" 
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/30 cursor-pointer text-sm"
                        >
                          {editingItem ? 'সংরক্ষণ করুন (Save Changes)' : 'মেনু যোগ করুন (Add Menu)'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
