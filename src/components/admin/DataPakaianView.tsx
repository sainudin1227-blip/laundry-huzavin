import { useState } from 'react';
import { Camera, Edit3, Eye, Plus, Search, Shirt, Trash2, Upload, X } from 'lucide-react';
import {
  CLOTHING_CATEGORIES,
  CLOTHING_CONDITIONS,
  formatWeightKg,
  getStageLabel,
  ORDER_STAGES,
  parseWeightInput,
} from '../../lib/laundryRules';
import { adminFetch, getAdminProtectedAssetUrl } from '../../lib/adminAuthClient';
import type { OrderItemClient, OrderRecordClient } from '../../types';

interface DataPakaianViewProps {
  clothingItems: OrderItemClient[];
  orders: OrderRecordClient[];
  onOpenOrderDetail: (orderId: string) => void;
  onGoToManualOrder: () => void;
  onChanged: (message: string) => Promise<void>;
}

export function DataPakaianView({
  clothingItems,
  orders,
  onOpenOrderDetail,
  onGoToManualOrder,
  onChanged,
}: DataPakaianViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Modal state for + TAMBAH DATA PAKAIAN / Edit item
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItemClient | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState(orders[0]?.id ?? '');
  const [category, setCategory] = useState<string>(CLOTHING_CATEGORIES[0]);
  const [quantity, setQuantity] = useState(1);
  const [weightStr, setWeightStr] = useState('0.5');
  const [conditionNote, setConditionNote] = useState<string>(CLOTHING_CONDITIONS[0]);
  const [specialNote, setSpecialNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = clothingItems.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL' || item.orderStatus === statusFilter;
    const matchesDate =
      !dateFilter || (item.orderCreatedAt ?? item.createdAt).slice(0, 10) === dateFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (item.customerName ?? '').toLowerCase().includes(q) ||
      (item.orderCode ?? '').toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.conditionNote.toLowerCase().includes(q) ||
      item.specialNote.toLowerCase().includes(q);

    return matchesCat && matchesStatus && matchesDate && matchesSearch;
  });

  function openAddModal() {
    setEditingItem(null);
    setSelectedOrderId(orders[0]?.id ?? '');
    setCategory(CLOTHING_CATEGORIES[0]);
    setQuantity(1);
    setWeightStr('0.5');
    setConditionNote(CLOTHING_CONDITIONS[0]);
    setSpecialNote('');
    setPhotoDataUrl('');
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(item: OrderItemClient) {
    setEditingItem(item);
    setSelectedOrderId(item.orderId);
    setCategory(item.category);
    setQuantity(item.quantity);
    setWeightStr(String(item.weightKg));
    setConditionNote(item.conditionNote);
    setSpecialNote(item.specialNote);
    setPhotoDataUrl('');
    setFormError('');
    setModalOpen(true);
  }

  function handlePhotoInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Ukuran foto maksimal 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhotoDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const targetOrderId = editingItem ? editingItem.orderId : selectedOrderId;
    if (!targetOrderId) {
      setFormError('Pilih pesanan terlebih dahulu atau buat pesanan manual baru.');
      return;
    }

    setSaving(true);
    try {
      const url = editingItem
        ? `/api/admin/order-items/${editingItem.id}`
        : `/api/admin/orders/${targetOrderId}/items`;
      const method = editingItem ? 'PUT' : 'POST';

      const res = await adminFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          quantity: Math.max(1, quantity),
          weightKg: parseWeightInput(weightStr),
          conditionNote,
          specialNote: specialNote.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal menyimpan data pakaian.');
        return;
      }

      if (photoDataUrl) {
        await adminFetch(`/api/admin/orders/${targetOrderId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataUrl: photoDataUrl,
            photoStage: 'sebelum',
            caption: `${category} (${conditionNote})`,
          }),
        });
      }

      setModalOpen(false);
      await onChanged(
        editingItem ? 'Data pakaian berhasil diperbarui.' : 'Data pakaian berhasil ditambahkan.'
      );
    } catch {
      setFormError('Gagal terhubung ke server.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteItem(itemId: string) {
    const res = await adminFetch(`/api/admin/order-items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      setConfirmDeleteId(null);
      await onChanged('Data pakaian berhasil dihapus.');
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl bg-white border border-sky-100 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-bold text-lg sm:text-xl text-[#0F2744]">
              Data Pakaian Pelanggan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pantau setiap jenis pakaian pelanggan, jumlah, berat, foto dokumentasi, kondisi, status pengerjaan, dan catatan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-extrabold shadow-sm shadow-sky-600/20"
            >
              <Plus className="w-4 h-4" />
              TAMBAH DATA PAKAIAN
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode order, nama, pakaian..."
              className="w-full min-h-[44px] pl-10 pr-3 py-2 rounded-xl border border-slate-200 focus:border-sky-500 outline-none text-sm"
            />
          </div>

          <select
            aria-label="Filter jenis pakaian"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
          >
            <option value="ALL">Semua Jenis Pakaian</option>
            {CLOTHING_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter status pengerjaan"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
          >
            <option value="ALL">Semua Status Pengerjaan</option>
            {ORDER_STAGES.map((stage) => (
              <option key={stage.code} value={stage.code}>
                {stage.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Filter tanggal masuk"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm tabular-nums"
            />
            {(searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('ALL');
                  setStatusFilter('ALL');
                  setDateFilter('');
                }}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 shrink-0"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Empty State */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-sky-200 rounded-2xl bg-sky-50/40 px-4">
            <Shirt className="w-10 h-10 text-sky-300 mx-auto mb-2" aria-hidden="true" />
            <p className="font-semibold text-slate-700 text-sm">
              Belum ada data pakaian yang tercatat.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Klik <strong>+ TAMBAH DATA PAKAIAN</strong> atau buat pesanan manual untuk mulai mencatat rincian pakaian pelanggan.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-sky-100 bg-[#F8FBFF] p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.firstPhotoUrl ? (
                        <img
                          src={getAdminProtectedAssetUrl(item.firstPhotoUrl)}
                          alt={item.category}
                          className="w-12 h-12 rounded-xl object-cover border border-sky-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                          <Shirt className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-[#0F2744] truncate">
                          {item.category} · {item.quantity} pcs
                        </p>
                        <p className="text-xs text-slate-600 truncate">
                          {item.customerName} ·{' '}
                          <span className="font-mono font-bold text-sky-800">{item.orderCode}</span>
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-white border border-sky-200 text-[10px] font-bold text-sky-800 shrink-0">
                      {item.orderStatus ? getStageLabel(item.orderStatus) : '-'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>
                      Berat: <strong className="tabular-nums">{formatWeightKg(item.weightKg)}</strong> · Kondisi:{' '}
                      <strong>{item.conditionNote}</strong>
                    </p>
                    {item.specialNote && <p>Catatan: {item.specialNote}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-sky-100">
                    <button
                      type="button"
                      onClick={() => onOpenOrderDetail(item.orderId)}
                      className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detail
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="min-h-[38px] inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-sky-200 text-sky-800 text-xs font-bold"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    {confirmDeleteId === item.id ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold"
                      >
                        Hapus!
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label="Hapus data pakaian"
                        className="min-h-[38px] w-[38px] inline-flex items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-sky-100 text-slate-500 text-xs font-semibold">
                    <th className="py-3 px-2.5">Foto &amp; Jenis Pakaian</th>
                    <th className="py-3 px-2.5">Kode Order &amp; Pelanggan</th>
                    <th className="py-3 px-2.5">Jumlah &amp; Berat</th>
                    <th className="py-3 px-2.5">Kondisi &amp; Catatan</th>
                    <th className="py-3 px-2.5">Status Pengerjaan</th>
                    <th className="py-3 px-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => (
                    <tr key={item.id} className="hover:bg-sky-50/40">
                      <td className="py-3 px-2.5">
                        <div className="flex items-center gap-3">
                          {item.firstPhotoUrl ? (
                            <img
                              src={getAdminProtectedAssetUrl(item.firstPhotoUrl)}
                              alt={item.category}
                              className="w-11 h-11 rounded-xl object-cover border border-sky-200 shrink-0"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                              <Shirt className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-[#0F2744]">{item.category}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1">
                              <Camera className="w-3 h-3" /> {item.photoCount ?? 0} foto
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2.5">
                        <div className="font-mono font-bold text-sky-800 text-xs">{item.orderCode}</div>
                        <div className="font-semibold text-slate-900">{item.customerName}</div>
                      </td>
                      <td className="py-3 px-2.5 tabular-nums whitespace-nowrap">
                        <div className="font-bold text-slate-900">{item.quantity} pcs</div>
                        <div className="text-xs text-slate-500">{formatWeightKg(item.weightKg)}</div>
                      </td>
                      <td className="py-3 px-2.5 max-w-[220px]">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          {item.conditionNote}
                        </span>
                        {item.specialNote && (
                          <p className="text-xs text-slate-500 mt-1 truncate" title={item.specialNote}>
                            {item.specialNote}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-2.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200 text-xs font-semibold text-sky-800">
                          {item.orderStatus ? getStageLabel(item.orderStatus) : '-'}
                        </span>
                      </td>
                      <td className="py-3 px-2.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenOrderDetail(item.orderId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            aria-label="Edit item"
                            className="p-2 rounded-xl bg-sky-50 text-sky-800 hover:bg-sky-100"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === item.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold"
                            >
                              Hapus!
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              aria-label="Hapus item"
                              className="p-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal: + TAMBAH / EDIT DATA PAKAIAN */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="data-pakaian-modal-title"
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center sm:p-4"
        >
          <div className="w-full sm:max-w-lg bg-white sm:rounded-3xl rounded-t-3xl border border-sky-200 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 border-b border-sky-100 flex items-center justify-between gap-3">
              <h3 id="data-pakaian-modal-title" className="font-display font-bold text-lg text-[#0F2744]">
                {editingItem ? 'Edit Data Pakaian' : 'Tambah Data Pakaian'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup modal data pakaian"
                className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
                  {formError}
                </div>
              )}

              {!editingItem && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilih Pesanan Terkait
                  </label>
                  {orders.length === 0 ? (
                    <div className="rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs text-slate-700 space-y-2">
                      <p>Belum ada pesanan di database. Buat pesanan manual terlebih dahulu.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setModalOpen(false);
                          onGoToManualOrder();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold"
                      >
                        Buka Tambah Pesanan Manual
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.orderCode} — {o.customerName} ({o.serviceName})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Pakaian
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    {CLOTHING_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah Pakaian (pcs)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Berat (kg)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={weightStr}
                    onChange={(e) => setWeightStr(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kondisi Pakaian
                  </label>
                  <select
                    value={conditionNote}
                    onChange={(e) => setConditionNote(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  >
                    {CLOTHING_CONDITIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={specialNote}
                  onChange={(e) => setSpecialNote(e.target.value)}
                  placeholder="Catatan kondisi noda / perlakuan khusus..."
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Foto Pakaian (Opsional)
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold cursor-pointer">
                    <Camera className="w-4 h-4" /> Kamera
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoInput}
                      className="hidden"
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer">
                    <Upload className="w-4 h-4" /> Pilih File
                    <input type="file" accept="image/*" onChange={handlePhotoInput} className="hidden" />
                  </label>
                </div>
                {photoDataUrl && (
                  <img
                    src={photoDataUrl}
                    alt="Preview pakaian"
                    className="mt-2.5 w-32 h-24 object-cover rounded-xl border border-sky-200"
                  />
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving || (!editingItem && orders.length === 0)}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-xs font-bold"
                >
                  {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Data Pakaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
