const KUNCI_USER = "tugasku-user";
const KUNCI_ANIMASI = "tugasku-animasi";
const BASE = {
  tugas: "tugasku-tugas",
  mandiri: "tugasku-mandiri",
  tim: "tugasku-tim",
  riwayat: "tugasku-riwayat",
  notif: "tugasku-notif",
};

let user = "";
const kunci = (b) => b + "::" + user.toLowerCase();

const KELOMPOK_KOSONG = { id: null, judul: "", jenis: "", deadline: "", anggota: [] };

let tugas = [];
let mandiri = [];
let mandiriAktif = null;
let tim = [];
let riwayat = []; 
let kelompok = KELOMPOK_KOSONG;
let notifTerkirim = [];
let viewAktif = "dashboard";
let kalTahun = new Date().getFullYear();
let kalBulan = new Date().getMonth();
let barusSelesai = -1;

const $ = (id) => document.getElementById(id);

function baca(k, awal) {
  try {
    const data = JSON.parse(localStorage.getItem(k));
    return Array.isArray(data) ? data : awal();
  } catch (e) {
    return awal();
  }
}

function tulis(k, data) {
  try {
    localStorage.setItem(k, JSON.stringify(data));
  } catch (e) { /* penyimpanan penuh / diblokir */ }
}

function simpanTugas() { tulis(kunci(BASE.tugas), tugas); }
function simpanRiwayat() { tulis(kunci(BASE.riwayat), riwayat); }
function simpanTim() {
  tulis(kunci(BASE.tim), tim);
  if (kelompok.id !== null) {
    kelompok.anggota = tim.map((a) => ({ ...a }));
    simpanRiwayat();
  }
}
function simpanSemua() {
  simpanTugas();
  tulis(kunci(BASE.mandiri), mandiri);
}

function muatData() {
  tugas = baca(kunci(BASE.tugas), () => []);
  mandiri = baca(kunci(BASE.mandiri), () => []);
  tim = baca(kunci(BASE.tim), () => []);
  riwayat = baca(kunci(BASE.riwayat), () => []);
  notifTerkirim = baca(kunci(BASE.notif), () => []);
  kelompok = riwayat[0] || KELOMPOK_KOSONG;
  mandiriAktif = mandiri.length ? mandiri[0].id : null;
}

// ---------- Util ----------
const pad = (n) => String(n).padStart(2, "0");

function kunciTanggal(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function mulaiHari(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function selisihHari(iso) {
  return Math.round((mulaiHari(iso) - mulaiHari(new Date())) / 86400000);
}

function jam(iso) {
  const d = new Date(iso);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function tglPendek(iso) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function tglPanjang(iso) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function labelHari(iso) {
  const s = selisihHari(iso);
  if (s === 0) return "Hari ini";
  if (s === 1) return "Besok";
  return tglPendek(iso);
}

function badgeHari(iso) {
  const s = selisihHari(iso);
  if (s < 0) return ["Terlambat", "telat"];
  if (s === 0) return ["Hari ini", "telat"];
  if (s === 1) return ["H-1", "telat"];
  return ["Terjadwal", "ok"];
}

function formatPersen(angka) {
  const bulat = Math.round(angka * 10) / 10;
  return String(bulat).replace(".", ",") + "%";
}

function el(tag, kelas, teks) {
  const e = document.createElement(tag);
  if (kelas) e.className = kelas;
  if (teks !== undefined) e.textContent = teks;
  return e;
}

function acak(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let timerToast;
function toast(pesan, ms) {
  const t = $("toast");
  t.textContent = pesan;
  t.hidden = false;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => (t.hidden = true), ms || 2400);
}

function tugasAktifUrut() {
  return tugas
    .filter((t) => !t.selesai)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}

// ---------- Jenis tugas: bagian, subtugas, estimasi ----------
function jenisKunci(jenis) {
  const j = (jenis || "").toLowerCase();
  if (j.includes("ppt") || j.includes("presentasi")) return "ppt";
  if (j.includes("laporan")) return "laporan";
  if (j.includes("makalah")) return "makalah";
  if (j.includes("diskusi")) return "diskusi";
  return "lain";
}

const LABEL_JENIS = { laporan: "Laporan", makalah: "Makalah", ppt: "PPT", diskusi: "Diskusi", lain: "Tugas" };

const BAGIAN = {
  makalah: ["Pendahuluan", "Landasan Teori", "Metode", "Pembahasan", "Kesimpulan", "Daftar Pustaka"],
  laporan: ["Pendahuluan", "Metode", "Hasil", "Pembahasan", "Kesimpulan", "Dokumentasi"],
  ppt: ["Desain Slide", "Materi Inti", "Latihan Presentasi", "Ringkasan", "Riset Data", "Revisi Akhir"],
  diskusi: ["Pendahuluan", "Materi", "Pengerjaan", "Penutup", "Referensi", "Revisi"],
  lain: ["Pendahuluan", "Materi", "Pengerjaan", "Penutup", "Referensi", "Revisi"],
};

function daftarBagian(jenis, n) {
  const dasar = [...BAGIAN[jenisKunci(jenis)], "Penyuntingan", "Finalisasi"];
  while (dasar.length < n) dasar.push("Bagian " + (dasar.length + 1));
  return dasar.slice(0, n);
}

const SUBTUGAS = {
  laporan: ["Pendahuluan", "Metode / Pelaksanaan", "Hasil", "Pembahasan", "Kesimpulan & Dokumentasi"],
  makalah: ["Pendahuluan", "Landasan Teori", "Pembahasan", "Kesimpulan", "Daftar Pustaka"],
  ppt: ["Riset Materi", "Susun Outline", "Desain Slide", "Latihan Presentasi", "Revisi Akhir"],
  diskusi: ["Pahami Topik", "Kumpulkan Referensi", "Siapkan Poin Diskusi", "Ikuti Diskusi", "Rangkuman Hasil"],
  lain: ["Pahami Tugas", "Kumpulkan Bahan", "Kerjakan", "Periksa Ulang", "Kumpulkan"],
};

function subtugasUntuk(jenis) {
  return SUBTUGAS[jenisKunci(jenis)];
}

const JAM_ESTIMASI = { ppt: 3, laporan: 5, makalah: 4, diskusi: 2, lain: 4 };

function estimasiJam(jenis) {
  return JAM_ESTIMASI[jenisKunci(jenis)];
}

function kelasProgres(p) {
  if (p >= 100) return "hijau";
  if (p >= 50) return "oranye";
  if (p > 0) return "coklat-t";
  return "abu";
}

function statusBagian(p) {
  if (p >= 100) return "selesai";
  if (p >= 50) return "berjalan";
  if (p > 0) return "mulai";
  return "belum mulai";
}

//Tugas mandiri: hitung progres 
function hitungProgres(m) {
  const total = m.subtugas.length;
  if (!total) return 0;
  return Math.round((m.subtugas.filter((s) => s.selesai).length / total) * 100);
}

function sinkronMandiri(m) {
  const t = tugas.find((x) => x.id === m.id);
  if (!t) return;
  t.progres = hitungProgres(m);
  t.selesai = t.progres === 100;
}


// LOGIN

$("formLogin").addEventListener("submit", (e) => {
  e.preventDefault();
  const nama = $("loginNama").value.trim();
  const sandi = $("loginSandi").value;
  const pesan = $("loginPesan");

  if (!nama) {
    getarPesan(pesan, "Nama pengguna wajib diisi.");
    return;
  }
  if (sandi.length < 4) {
    getarPesan(pesan, "Password minimal 4 karakter.");
    return;
  }

  pesan.hidden = true;
  localStorage.setItem(KUNCI_USER, nama);
  $("loginSandi").value = "";
  bukaAplikasi();
});

$("tombolKeluar").addEventListener("click", () => {
  localStorage.removeItem(KUNCI_USER);
  user = "";
  tutupMenu();
  $("aplikasi").hidden = true;
  $("halamanLogin").hidden = false;
});

function bukaAplikasi() {
  user = localStorage.getItem(KUNCI_USER) || "Pengguna";
  muatData();
  $("namaUser").textContent = user + ".";
  $("halamanLogin").hidden = true;
  $("aplikasi").hidden = false;
  tampilkan("dashboard");
  perbaruiTombolNotif();
  cekDeadline();
}

// =====================================================
// MENU HAMBURGER (HP / tablet)
// =====================================================
function bukaMenu() {
  $("sidebar").classList.add("buka");
  $("overlay").classList.add("tampil");
  document.body.classList.add("menu-buka");
  $("tombolMenu").setAttribute("aria-expanded", "true");
}

function tutupMenu() {
  $("sidebar").classList.remove("buka");
  $("overlay").classList.remove("tampil");
  document.body.classList.remove("menu-buka");
  $("tombolMenu").setAttribute("aria-expanded", "false");
}

$("tombolMenu").addEventListener("click", () => {
  if ($("sidebar").classList.contains("buka")) tutupMenu();
  else bukaMenu();
});
$("tombolTutupMenu").addEventListener("click", tutupMenu);
$("overlay").addEventListener("click", tutupMenu);
window.addEventListener("resize", () => {
  if (window.innerWidth > 1024) tutupMenu();
});

// =====================================================
// NAVIGASI
// =====================================================
function renderView(nama) {
  if (nama === "dashboard") renderDashboard();
  if (nama === "kelompok") renderKelompok();
  if (nama === "mandiri") renderMandiri();
  if (nama === "pembagian") renderPembagian();
  if (nama === "kalender") renderKalender();
  renderNotifikasi();
}

function tampilkan(nama) {
  viewAktif = nama;
  document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + nama));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.toggle("aktif", n.dataset.view === nama));
  tutupMenu();
  renderView(nama);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function segarkan() {
  renderView(viewAktif);
}

document.querySelectorAll("[data-view]").forEach((b) => {
  b.addEventListener("click", () => tampilkan(b.dataset.view));
});

// =====================================================
// NOTIFIKASI (sidebar)
// =====================================================
function renderNotifikasi() {
  const box = $("notifList");
  box.innerHTML = "";
  const aktif = tugasAktifUrut();

  if (viewAktif === "dashboard") {
    const dua = aktif.slice(0, 2);
    if (dua.length === 0) {
      box.appendChild(el("span", "kecil", "Tidak ada notifikasi"));
      return;
    }
    dua.forEach((t, i) => {
      const mendesak = selisihHari(t.deadline) <= 1;
      const chip = el("span", "notif-chip " + (i === 0 && mendesak ? "merah-muda" : "oranye-muda"));
      chip.appendChild(document.createTextNode(t.judul));
      if (i === 0 && mendesak) chip.appendChild(el("span", "tanda", "!"));
      box.appendChild(chip);
    });
    return;
  }

  const dekat = aktif.filter((t) => selisihHari(t.deadline) <= 1).length;
  if (dekat === 0) {
    box.appendChild(el("span", "kecil", "Tidak ada notifikasi"));
  } else {
    box.appendChild(el("span", "notif-chip oranye-muda", `${dekat} deadline dekat`));
  }
}

// =====================================================
// PENGINGAT H-1 (notifikasi sistem + toast di dalam aplikasi)
// =====================================================
const SEHARI = 24 * 60 * 60 * 1000;

const dukungNotif = () => "Notification" in window;

async function kirimNotifSistem(judul, isi, tag) {
  if (!dukungNotif() || Notification.permission !== "granted") return false;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(judul, { body: isi, tag, icon: "icon.svg", badge: "icon.svg" });
        return true;
      }
    }
    new Notification(judul, { body: isi, tag });
    return true;
  } catch (e) {
    return false;
  }
}

function cekDeadline() {
  if (!user) return;
  const sekarang = Date.now();
  const baru = tugasAktifUrut().filter((t) => {
    const sisa = new Date(t.deadline) - sekarang;
    return sisa > 0 && sisa <= SEHARI && !notifTerkirim.includes(t.id);
  });
  if (baru.length === 0) return;

  baru.forEach((t) => {
    notifTerkirim.push(t.id);
    const jamSisa = Math.max(1, Math.ceil((new Date(t.deadline) - sekarang) / 3600000));
    kirimNotifSistem(
      "Deadline kurang dari 24 jam",
      `${t.judul} • ${labelHari(t.deadline)} pukul ${jam(t.deadline)} (± ${jamSisa} jam lagi)`,
      "tugasku-" + t.id
    );
  });
  tulis(kunci(BASE.notif), notifTerkirim);

  toast(
    baru.length === 1
      ? `Pengingat: "${baru[0].judul}" deadline ${labelHari(baru[0].deadline).toLowerCase()} pukul ${jam(baru[0].deadline)}`
      : `Pengingat: ${baru.length} tugas deadline dalam 24 jam`,
    5500
  );
}

function perbaruiTombolNotif() {
  const b = $("tombolNotif");
  if (!dukungNotif()) {
    b.textContent = "Notifikasi: tidak didukung";
    b.dataset.status = "mati";
    return;
  }
  const p = Notification.permission;
  b.dataset.status = p;
  b.textContent =
    p === "granted" ? "Notifikasi H-1: aktif" : p === "denied" ? "Notifikasi: diblokir" : "Aktifkan notifikasi H-1";
}

$("tombolNotif").addEventListener("click", async () => {
  if (!dukungNotif()) {
    toast("Browser ini tidak mendukung notifikasi. Di iPhone/iPad, tambahkan situs ke Layar Utama dulu.", 4500);
    return;
  }
  if (Notification.permission === "denied") {
    toast("Notifikasi diblokir. Aktifkan lewat pengaturan situs di browser.", 4000);
    return;
  }
  if (Notification.permission === "default") {
    await Notification.requestPermission();
    perbaruiTombolNotif();
    if (Notification.permission !== "granted") return;
  }
  const ok = await kirimNotifSistem("TugasKu", "Notifikasi aktif. Kamu akan diingatkan 1 hari sebelum deadline.", "tugasku-tes");
  toast(ok ? "Notifikasi aktif. Pengingat H-1 akan muncul." : "Notifikasi aktif.");
  cekDeadline();
});

// Cek tiap menit & saat tab kembali dibuka
setInterval(cekDeadline, 60 * 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) cekDeadline();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// =====================================================
// DASHBOARD
// =====================================================
function renderDashboard() {
  const total = tugas.length;
  const selesai = tugas.filter((t) => t.selesai).length;
  const aktif = tugasAktifUrut();
  const dekat = aktif.filter((t) => selisihHari(t.deadline) <= 3).length;
  const proses = aktif.filter((t) => t.progres > 0).length;
  const persen = total ? (selesai / total) * 100 : 0;

  setAngka($("statTotal"), total);
  setAngka($("statBelum"), total - selesai);
  setAngka($("statSelesai"), selesai);
  setAngka($("statDekat"), dekat);

  animDonut(persen);

  $("donutKet").textContent = `${selesai} dari ${total} tugas selesai`;
  $("chipSelesai").textContent = `${selesai} selesai`;
  $("chipProses").textContent = `${proses} dalam proses`;

  const daftar = $("daftarDeadline");
  daftar.innerHTML = "";

  if (aktif.length === 0) {
    daftar.appendChild(
      el("p", "kosong-info", total === 0 ? "Belum ada tugas. Klik + Tambah Tugas untuk memulai." : "Semua tugas sudah selesai. Kerja bagus! 🎉")
    );
    $("pengingat").textContent = "Pengingat berikutnya: tidak ada";
    return;
  }

  $("pengingat").textContent = `Pengingat berikutnya: ${aktif[0].judul} • 1 hari sebelum deadline`;

  aktif.slice(0, 3).forEach((t) => {
    const [teks, kelas] = badgeHari(t.deadline);
    const baris = el("article", "baris-deadline " + kelas);
    const kiri = el("div");
    kiri.appendChild(el("strong", "", t.judul));
    kiri.appendChild(
      el("small", "", `${labelHari(t.deadline)} • ${jam(t.deadline)} • Progress ${t.progres}%`)
    );

    baris.append(kiri, el("span", "badge " + kelas, teks));
    daftar.appendChild(baris);
  });
}

$("tombolMulai").addEventListener("click", () => {
  const aktif = tugasAktifUrut();
  if (aktif.length === 0) {
    toast("Tidak ada tugas yang perlu dikerjakan.");
    return;
  }
  bukaFokus(aktif[0].id);
});

// =====================================================
// TUGAS KELOMPOK
// =====================================================
function ringkasanTim() {
  const kepala = kelompok.id !== null
    ? `Tugas Kelompok: ${kelompok.judul}\nDeadline: ${tglPanjang(kelompok.deadline)} • ${jam(kelompok.deadline)}\n\n`
    : "Tugas Kelompok\n\n";
  return kepala + tim.map((a) => `- ${a.nama}: ${a.bagian} (${a.progres}%)`).join("\n");
}

function salinRingkasan() {
  if (tim.length === 0) {
    toast("Belum ada anggota untuk dibagikan.");
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(ringkasanTim()).then(
      () => toast("Ringkasan disalin. Tempel ke grup kamu!"),
      () => toast("Gagal menyalin ringkasan.")
    );
  } else {
    toast("Browser tidak mendukung salin otomatis.");
  }
}

function hapusAnggota(i) {
  const nama = tim[i].nama;
  tim.splice(i, 1);
  simpanTim();
  renderKelompok();
  toast(`Anggota "${nama}" dihapus.`);
}

function pilihKelompok(id) {
  const k = riwayat.find((r) => r.id === id);
  if (!k) return;
  kelompok = k;
  tim = k.anggota.map((a) => ({ ...a }));
  tulis(kunci(BASE.tim), tim);
  renderKelompok();
  toast(`Kelompok "${k.judul}" dipilih.`);
}

function hapusKelompok(id) {
  const k = riwayat.find((r) => r.id === id);
  if (!k) return;
  if (!confirm(`Hapus kelompok "${k.judul}"? Tugasnya di dashboard juga ikut terhapus.`)) return;

  riwayat = riwayat.filter((r) => r.id !== id);
  tugas = tugas.filter((t) => t.id !== id);
  notifTerkirim = notifTerkirim.filter((x) => x !== id);
  if (kelompok.id === id) {
    kelompok = riwayat[0] || KELOMPOK_KOSONG;
    tim = kelompok.anggota.map((a) => ({ ...a }));
    tulis(kunci(BASE.tim), tim);
  }
  simpanRiwayat();
  simpanTugas();
  tulis(kunci(BASE.notif), notifTerkirim);
  renderKelompok();
  renderNotifikasi();
  toast("Kelompok dihapus.");
}

function hapusSemuaKelompok() {
  if (riwayat.length === 0) return;
  if (!confirm("Hapus semua riwayat kelompok beserta tugasnya di dashboard?")) return;
  const ids = new Set(riwayat.map((r) => r.id));
  tugas = tugas.filter((t) => !ids.has(t.id));
  riwayat = [];
  kelompok = KELOMPOK_KOSONG;
  tim = [];
  simpanRiwayat();
  simpanTugas();
  tulis(kunci(BASE.tim), tim);
  renderKelompok();
  renderNotifikasi();
  toast("Semua kelompok dihapus.");
}

function renderKelompok() {
  const ul = $("daftarAnggota");
  ul.innerHTML = "";
  if (tim.length === 0) {
    ul.appendChild(el("li", "kosong-li", "Belum ada anggota. Tambah di menu Pembagian Tugas."));
  }
  tim.forEach((a, i) => {
    const li = el("li", kelasProgres(a.progres));
    li.appendChild(el("span", "", `${a.nama} • ${a.progres}%`));
    const x = el("button", "hapus-kecil", "✕");
    x.type = "button";
    x.title = `Hapus ${a.nama}`;
    x.setAttribute("aria-label", `Hapus anggota ${a.nama}`);
    x.addEventListener("click", () => hapusAnggota(i));
    li.appendChild(x);
    ul.appendChild(li);
  });

  if (kelompok.id === null) {
    $("pvJudul").textContent = "Belum ada tugas kelompok";
    $("pvDeadline").textContent = "Isi form di samping untuk membuat tugas.";
    $("pvProgres").textContent = "0% berjalan";
  } else {
    $("pvJudul").textContent = kelompok.judul;
    $("pvDeadline").textContent = `Deadline: ${tglPanjang(kelompok.deadline)} • ${jam(kelompok.deadline)}`;
    const rata = tim.length ? tim.reduce((s, a) => s + a.progres, 0) / tim.length : 0;
    $("pvProgres").textContent = `${Math.round(rata)}% berjalan`;
  }

  const box = $("daftarPembagian");
  box.innerHTML = "";
  if (tim.length === 0) box.appendChild(el("p", "kosong-info", "Belum ada pembagian tugas."));
  tim.forEach((a) => box.appendChild(el("div", "baris-pembagian", `${a.nama} • ${a.bagian}`)));

  // Riwayat kelompok 
  const rw = $("daftarRiwayat");
  rw.innerHTML = "";
  $("tombolHapusSemua").hidden = riwayat.length === 0;
  if (riwayat.length === 0) {
    rw.appendChild(el("p", "kosong-info", "Belum ada kelompok tersimpan."));
  }
  riwayat.forEach((r) => {
    const baris = el("article", "baris-riwayat" + (r.id === kelompok.id ? " aktif" : ""));
    const kiri = el("div", "riwayat-info");
    kiri.appendChild(el("strong", "", r.judul));
    kiri.appendChild(el("small", "", `${tglPendek(r.deadline)} • ${r.anggota.length} anggota${r.id === kelompok.id ? " • aktif" : ""}`));
    const aksi = el("div", "riwayat-aksi");
    if (r.id !== kelompok.id) {
      const pilih = el("button", "mini terang", "Pilih");
      pilih.type = "button";
      pilih.addEventListener("click", () => pilihKelompok(r.id));
      aksi.appendChild(pilih);
    }
    const hapus = el("button", "mini bahaya", "Hapus");
    hapus.type = "button";
    hapus.addEventListener("click", () => hapusKelompok(r.id));
    aksi.appendChild(hapus);
    baris.append(kiri, aksi);
    rw.appendChild(baris);
  });
}

$("kJenis").addEventListener("input", () => {
  $("kEstimasi").textContent = `± ${estimasiJam($("kJenis").value)} jam`;
});

$("formKelompok").addEventListener("submit", (e) => {
  e.preventDefault();
  const judul = $("kJudul").value.trim();
  const jenis = $("kJenis").value.trim() || "Makalah";
  const deadline = $("kDeadline").value;
  if (!judul || !deadline) return;

  const bagian = daftarBagian(jenis, tim.length);
  tim = tim.map((a, i) => ({ nama: a.nama, bagian: bagian[i], progres: 0 }));
  tulis(kunci(BASE.tim), tim);
  $("kEstimasi").textContent = `± ${estimasiJam(jenis)} jam`;

  // Satu tugas baru 
  const id = Date.now();
  kelompok = { id, judul, jenis, deadline, anggota: tim.map((a) => ({ ...a })) };
  riwayat.unshift(kelompok);
  simpanRiwayat();
  tugas.unshift({ id, judul, deadline, progres: 0, selesai: false });
  simpanTugas();

  renderKelompok();
  renderNotifikasi();
  cekDeadline();
  $("formKelompok").reset();
  toast(tim.length ? "Rencana dibuat & 1 tugas ditambahkan ke dashboard." : "Tugas dibuat. Tambah anggota di menu Pembagian Tugas.");
});

$("tombolAcak").addEventListener("click", () => {
  if (tim.length < 2) {
    toast("Minimal 2 anggota untuk diacak.");
    return;
  }
  const nama = acak(tim.map((a) => a.nama));
  tim.forEach((a, i) => (a.nama = nama[i]));
  simpanTim();
  renderKelompok();
  toast("Pembagian tugas diacak ulang.");
});

$("tombolBagikan").addEventListener("click", salinRingkasan);
$("tombolHapusSemua").addEventListener("click", hapusSemuaKelompok);

// TUGAS MANDIRI

function renderMandiri() {
  const pilih = $("pilihMandiri");
  const ul = $("daftarSubtugas");
  pilih.innerHTML = "";
  ul.innerHTML = "";

  const m = mandiri.find((x) => x.id === mandiriAktif);

  if (mandiri.length > 1) {
    mandiri.forEach((x) => {
      const b = el("button", x.id === mandiriAktif ? "aktif" : "", x.judul);
      b.type = "button";
      b.addEventListener("click", () => {
        mandiriAktif = x.id;
        renderMandiri();
      });
      pilih.appendChild(b);
    });
  }

  if (!m) {
    ul.appendChild(el("li", "kosong-info", "Belum ada tugas mandiri. Isi form lalu klik Buat Kerangka."));
    $("tombolMulaiMandiri").hidden = true;
    $("progresMandiri").hidden = true;
    return;
  }

  $("tombolMulaiMandiri").hidden = false;
  $("progresMandiri").hidden = false;

  const sekarang = m.subtugas.findIndex((s) => !s.selesai);

  m.subtugas.forEach((s, i) => {
    const li = el("li", (s.selesai ? "selesai " : "") + (i === sekarang ? "sekarang " : "") + (i === barusSelesai ? "baru" : ""));
    const label = el("label");
    const cek = el("input");
    cek.type = "checkbox";
    cek.checked = s.selesai;
    cek.addEventListener("change", () => {
      s.selesai = cek.checked;
      barusSelesai = cek.checked ? i : -1;
      if (cek.checked && m.subtugas.every((x) => x.selesai)) setTimeout(() => rayakan($("progresMandiri")), 60);
      sinkronMandiri(m);
      simpanSemua();
      renderMandiri();
      renderNotifikasi();
    });
    label.append(cek, el("span", "", `${i + 1}. ${s.teks}`));
    li.appendChild(label);
    ul.appendChild(li);
  });

  barusSelesai = -1;
  $("progresMandiri").textContent = `${hitungProgres(m)}% • ${m.judul}`;
}

$("mJenis").addEventListener("change", () => {
  $("mEstimasi").textContent = `± ${estimasiJam($("mJenis").value)} jam`;
});

$("formMandiri").addEventListener("submit", (e) => {
  e.preventDefault();
  const judul = $("mJudul").value.trim();
  const jenis = $("mJenis").value;
  const topik = $("mTopik").value.trim();
  const deadline = $("mDeadline").value;
  if (!judul || !deadline) return;

  const id = Date.now();
  mandiri.push({
    id,
    judul,
    jenis,
    topik,
    subtugas: subtugasUntuk(jenis).map((teks) => ({ teks, selesai: false })),
  });
  tugas.unshift({ id, judul, deadline, progres: 0, selesai: false });
  mandiriAktif = id;
  simpanSemua();

  $("formMandiri").reset();
  $("mEstimasi").textContent = `± ${estimasiJam($("mJenis").value)} jam`;
  renderMandiri();
  renderNotifikasi();
  cekDeadline();
  toast("Kerangka dibuat & 1 tugas ditambahkan ke dashboard.");
});

$("tombolMulaiMandiri").addEventListener("click", () => {
  if (mandiriAktif !== null) bukaFokus(mandiriAktif);
});

// PEMBAGIAN TUGAS

function renderPembagian() {
  const box = $("daftarProgres");
  box.innerHTML = "";

  if (tim.length === 0) {
    box.appendChild(el("p", "kosong-info terang-teks", "Belum ada anggota. Isi form lalu klik Bagi Tugas Secara Acak."));
  }

  tim.forEach((a) => {
    const kartu = el("div", "kartu-anggota");
    kartu.tabIndex = 0;
    kartu.setAttribute("role", "button");
    kartu.title = "Klik untuk menambah progress 10%";

    const kiri = el("div");
    kiri.appendChild(el("strong", "", a.nama));
    const ket = el("small", "", `${a.bagian} • ${statusBagian(a.progres)}`);
    kiri.appendChild(ket);

    const bar = el("div", "bar-pil");
    const isi = el("div", "isi", a.progres + "%");
    isi.style.width = Math.max(a.progres, 14) + "%";
    bar.appendChild(isi);

    kartu.append(kiri, bar);

    const tambah = () => {
      a.progres = a.progres >= 100 ? 0 : Math.min(100, a.progres + 10);
      simpanTim();
      isi.style.width = Math.max(a.progres, 14) + "%";
      isi.textContent = a.progres + "%";
      ket.textContent = `${a.bagian} • ${statusBagian(a.progres)}`;
      if (a.progres >= 100) rayakan(kartu);
    };
    kartu.addEventListener("click", tambah);
    kartu.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        tambah();
      }
    });

    box.appendChild(kartu);
  });
}

$("formPembagian").addEventListener("submit", (e) => {
  e.preventDefault();
  const topik = $("pTopik").value.trim();
  const jenis = $("pJenis").value;
  let n = parseInt($("pJumlah").value, 10);
  let nama = $("pNama").value.split(",").map((s) => s.trim()).filter(Boolean);

  if (nama.length === 0) {
    n = Number.isFinite(n) ? Math.min(8, Math.max(2, n)) : 4;
    nama = Array.from({ length: n }, (_, i) => (tim.length === n ? tim[i].nama : "Anggota " + (i + 1)));
  }

  if (nama.length < 2) {
    toast("Isi minimal 2 nama anggota.");
    return;
  }

  nama = nama.slice(0, 8);
  $("pJumlah").value = nama.length;

  const bagian = daftarBagian(jenis, nama.length);
  tim = acak(nama).map((nm, i) => ({ nama: nm, bagian: bagian[i], progres: 0 }));

  if (kelompok.id !== null) {
    kelompok.jenis = LABEL_JENIS[jenisKunci(jenis)];
    if (topik) {
      kelompok.judul = `${LABEL_JENIS[jenisKunci(jenis)]} ${topik}`;
      const t = tugas.find((x) => x.id === kelompok.id);
      if (t) {
        t.judul = kelompok.judul;
        simpanTugas();
      }
    }
  }

  simpanTim();
  renderPembagian();
  toast("Tugas dibagi secara acak untuk " + nama.length + " anggota.");
});

$("tombolBagikan2").addEventListener("click", salinRingkasan);

// =====================================================
// KALENDER
// =====================================================
function namaBulan(tahun, bulan) {
  const s = new Date(tahun, bulan, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function renderKalender() {
  $("kalJudul").textContent = namaBulan(kalTahun, kalBulan);

  const grid = $("kalGrid");
  grid.innerHTML = "";

  const awal = (new Date(kalTahun, kalBulan, 1).getDay() + 6) % 7; // Senin = 0
  const jumlahHari = new Date(kalTahun, kalBulan + 1, 0).getDate();
  const total = Math.ceil((awal + jumlahHari) / 7) * 7;
  const hariIni = kunciTanggal(new Date());
  const aktif = tugasAktifUrut();

  for (let i = 0; i < total; i++) {
    const tgl = i - awal + 1;
    if (tgl < 1 || tgl > jumlahHari) {
      grid.appendChild(el("div", "sel kosong"));
      continue;
    }

    const kunciTgl = `${kalTahun}-${pad(kalBulan + 1)}-${pad(tgl)}`;
    const sel = el("div", "sel" + (kunciTgl === hariIni ? " hari-ini" : ""));
    sel.style.setProperty("--i", i);
    sel.appendChild(el("span", "tgl", String(tgl)));

    const acara = tugas
      .filter((t) => t.deadline.slice(0, 10) === kunciTgl)
      .map((t) => ({ id: t.id, teks: t.judul, kelas: t.selesai ? "selesai" : "deadline" }));

    if (kunciTgl === hariIni && aktif.length) {
      acara.push({ id: aktif[0].id, teks: "Rencana: " + aktif[0].judul, kelas: "rencana" });
    }

    acara.slice(0, 2).forEach((a) => {
      const chip = el("button", "chip-kal " + a.kelas, a.teks);
      chip.type = "button";
      chip.title = a.teks;
      chip.addEventListener("click", (ev) => {
        ev.stopPropagation();
        bukaFokus(a.id);
      });
      sel.appendChild(chip);
    });
    if (acara.length > 2) sel.appendChild(el("span", "chip-lebih", `+${acara.length - 2}`));

    sel.addEventListener("click", () => bukaModalDeadline(kunciTgl));
    grid.appendChild(sel);
  }

  $("kalRencana").textContent = aktif.length
    ? `Rencana hari ini: 19:00–20:00 • ${aktif[0].judul}`
    : "Tidak ada rencana hari ini";

  // Daftar deadline bulan ini (lengkap, terutama untuk HP)
  const daftar = $("kalList");
  daftar.innerHTML = "";
  const bulanIni = tugas
    .filter((t) => {
      const d = new Date(t.deadline);
      return d.getFullYear() === kalTahun && d.getMonth() === kalBulan;
    })
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  if (bulanIni.length === 0) daftar.appendChild(el("li", "kosong-info", "Belum ada deadline bulan ini."));
  bulanIni.forEach((t) => {
    const li = el("li");
    li.append(
      el("span", "", `${new Date(t.deadline).getDate()} • ${t.judul}`),
      el("small", "", `${jam(t.deadline)} • ${t.selesai ? "Selesai" : "Deadline"}`)
    ); 
    li.addEventListener("click", () => bukaFokus(t.id));
    daftar.appendChild(li);
  });
}

$("kalPrev").addEventListener("click", () => {
  kalBulan--;
  if (kalBulan < 0) {
    kalBulan = 11;
    kalTahun--;
  }
  renderKalender();
});

$("kalNext").addEventListener("click", () => {
  kalBulan++;
  if (kalBulan > 11) {
    kalBulan = 0;
    kalTahun++;
  }
  renderKalender();
});

// ---------- Modal tambah deadline ----------
function bukaModalDeadline(kunciTgl) {
  $("dJudul").value = "";
  $("dDeadline").value = (kunciTgl || kunciTanggal(new Date())) + "T09:00";
  $("modalDeadline").hidden = false;
  $("dJudul").focus();
}

$("tombolTambahDeadline").addEventListener("click", () => bukaModalDeadline());
$("dBatal").addEventListener("click", () => ($("modalDeadline").hidden = true));

$("formDeadline").addEventListener("submit", (e) => {
  e.preventDefault();
  const judul = $("dJudul").value.trim();
  const deadline = $("dDeadline").value;
  if (!judul || !deadline) return;

  tugas.unshift({ id: Date.now(), judul, deadline, progres: 0, selesai: false });
  simpanTugas();
  $("modalDeadline").hidden = true;
  segarkan();
  cekDeadline();
  toast("Deadline ditambahkan.");
});

// FOCUS MODE
const DURASI_FOKUS = 25 * 60;
const fokus = { id: null, sisa: DURASI_FOKUS, timer: null };

function tampilTimer() {
  $("fokusTimer").textContent = `${pad(Math.floor(fokus.sisa / 60))}:${pad(fokus.sisa % 60)}`;
  $("fokusBar").style.transform = `scaleX(${1 - fokus.sisa / DURASI_FOKUS})`;
}

function hentikanTimer() {
  clearInterval(fokus.timer);
  fokus.timer = null;
  $("fokusMulai").textContent = fokus.sisa === DURASI_FOKUS ? "Mulai" : "Lanjut";
}

function infoFokus() {
  const t = tugas.find((x) => x.id === fokus.id);
  if (!t) return;
  const m = mandiri.find((x) => x.id === fokus.id);
  const sub = m ? m.subtugas.find((s) => !s.selesai) : null;

  $("fokusJudul").textContent = t.judul;
  $("fokusSub").textContent = m
    ? sub ? "Sekarang: " + sub.teks : "Semua subtugas selesai 🎉"
    : `Progress saat ini: ${t.progres}%`;

  const tombol = $("fokusSelesai");
  tombol.textContent = m ? "Subtugas selesai" : "+10% progress";
  tombol.disabled = t.selesai || (m && !sub);
}

function bukaFokus(id) {
  if (!tugas.some((t) => t.id === id)) return;
  fokus.id = id;
  fokus.sisa = DURASI_FOKUS;
  hentikanTimer();
  tampilTimer();
  infoFokus();
  $("fokus").hidden = false;
}

function tutupFokus() {
  hentikanTimer();
  fokus.sisa = DURASI_FOKUS;
  $("fokus").hidden = true;
}

$("fokusMulai").addEventListener("click", () => {
  if (fokus.timer) {
    hentikanTimer();
    return;
  }
  $("fokusMulai").textContent = "Jeda";
  fokus.timer = setInterval(() => {
    fokus.sisa--;
    tampilTimer();
    if (fokus.sisa <= 0) {
      fokus.sisa = DURASI_FOKUS;
      hentikanTimer();
      tampilTimer();
      toast("Waktu fokus selesai! Istirahat sebentar ☕");
    }
  }, 1000);
});

$("fokusSelesai").addEventListener("click", () => {
  const t = tugas.find((x) => x.id === fokus.id);
  if (!t) return;
  const m = mandiri.find((x) => x.id === fokus.id);

  if (m) {
    const sub = m.subtugas.find((s) => !s.selesai);
    if (!sub) return;
    sub.selesai = true;
    sinkronMandiri(m);
    toast(`"${sub.teks}" selesai!`);
  } else {
    t.progres = Math.min(100, t.progres + 10);
    if (t.progres >= 100) t.selesai = true;
    toast(`Progress naik jadi ${t.progres}%`);
  }

  simpanSemua();
  infoFokus();
  segarkan();
  if (t.selesai) rayakan($("fokusJudul"));
});

$("fokusTutup").addEventListener("click", tutupFokus);

// Klik latar gelap menutup modal; Esc menutup semuanya
$("fokus").addEventListener("click", (e) => {
  if (e.target === $("fokus")) tutupFokus();
});
$("modalDeadline").addEventListener("click", (e) => {
  if (e.target === $("modalDeadline")) $("modalDeadline").hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  tutupMenu();
  tutupFokus();
  $("modalDeadline").hidden = true;
});

// =====================================================
// ANIMASI (bisa dimatikan / otomatis hemat di HP lemah)
// =====================================================
const hemat = () => document.documentElement.classList.contains("hemat");

function aturAnimasi(hidup) {
  document.documentElement.classList.toggle("hemat", !hidup);
  const b = $("tombolAnimasi");
  b.setAttribute("aria-pressed", String(hidup));
  b.textContent = hidup ? "Animasi: hidup" : "Animasi: hemat";
}

$("tombolAnimasi").addEventListener("click", () => {
  const hidup = $("tombolAnimasi").getAttribute("aria-pressed") !== "true";
  localStorage.setItem(KUNCI_ANIMASI, hidup ? "1" : "0");
  aturAnimasi(hidup);
  toast(hidup ? "Animasi dihidupkan." : "Mode hemat: animasi dimatikan.");
});

// Pilihan pengguna menang; kalau belum memilih, deteksi perangkat lemah / hemat data
(function () {
  const pilihan = localStorage.getItem(KUNCI_ANIMASI);
  const lemah =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (navigator.connection && navigator.connection.saveData) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  aturAnimasi(pilihan ? pilihan === "1" : !lemah);
})();

// Hitung naik angka / donut dengan satu requestAnimationFrame
function tween(dari, ke, ms, tiap) {
  if (hemat() || dari === ke) {
    tiap(ke);
    return;
  }
  const t0 = performance.now();
  const langkah = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    tiap(dari + (ke - dari) * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(langkah);
  };
  requestAnimationFrame(langkah);
}

function setAngka(e, ke) {
  const dari = Number(e.dataset.v || 0);
  e.dataset.v = ke;
  if (dari !== ke && !hemat()) {
    e.classList.remove("pop");
    void e.offsetWidth;
    e.classList.add("pop");
  }
  tween(dari, ke, 700, (v) => (e.textContent = Math.round(v)));
}

function animDonut(persen) {
  const d = $("donut");
  const dari = Number(d.dataset.v || 0);
  d.dataset.v = persen;
  tween(dari, persen, 800, (v) => {
    d.style.setProperty("--p", v);
    $("donutPersen").textContent = formatPersen(v);
  });
}

// Percikan kecil saat tugas selesai (12 titik, dibuang setelah 0,9 detik)
function rayakan(sumber) {
  if (hemat() || !sumber) return;
  const r = sumber.getBoundingClientRect();
  const w = el("div", "konfeti");
  w.style.left = r.left + r.width / 2 + "px";
  w.style.top = r.top + r.height / 2 + "px";
  const warna = ["#a30000", "#f8b9c3", "#e0a83a", "#336600"];
  for (let i = 0; i < 12; i++) {
    const p = el("i");
    const sudut = (i / 12) * 6.283 + Math.random() * 0.4;
    const jarak = 40 + Math.random() * 50;
    p.style.cssText = `--x:${Math.cos(sudut) * jarak}px;--y:${Math.sin(sudut) * jarak}px;background:${warna[i % 4]}`;
    w.appendChild(p);
  }
  document.body.appendChild(w);
  setTimeout(() => w.remove(), 900);
}

// Riak (ripple) lembut saat tombol ditekan
document.addEventListener(
  "pointerdown",
  (e) => {
    if (hemat()) return;
    const b = e.target.closest(".tombol-coklat, .tombol-banner, .tombol-masuk, .tombol-pembagian-tgs, .pil, .pil-kal, .mini");
    if (!b || b.disabled) return;
    const r = b.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const rp = el("span", "riak");
    rp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    b.appendChild(rp);
    setTimeout(() => rp.remove(), 600);
  },
  { passive: true }
);

function getarPesan(e, teks) {
  e.textContent = teks;
  e.hidden = false;
  e.style.animation = "none";
  void e.offsetWidth;
  e.style.animation = "";
}

// Latar bergeser pelan mengikuti kursor (hanya mouse/trackpad, tidak di layar sentuh)
const latar = $("latar");
if (latar && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
  let rafId = 0, px = 0, py = 0;
  window.addEventListener("pointermove", (e) => {
    px = (e.clientX / window.innerWidth - 0.5) * -16;
    py = (e.clientY / window.innerHeight - 0.5) * -16;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (!hemat()) latar.style.transform = `translate3d(${px}px,${py}px,0)`;
    });
  }, { passive: true });
}

// =====================================================
// MULAI
// =====================================================
if (localStorage.getItem(KUNCI_USER)) {
  bukaAplikasi();
}