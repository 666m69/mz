/**
 * MZ702 Main Interactive Script
 * Handles rendering, filtering, modals, calculator, theme toggle, and lead generation
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Load Data
  const data = loadSiteData();
  const cfg = data.siteConfig;

  // 2. Initialize Theme (Dark mode by default for high-tech luxury feel)
  initTheme();

  // 3. Render Header & Hero
  renderHero(cfg);

  // 4. Render Services
  renderServices(data.services, cfg.currency);

  // 5. Render Projects & Filter system
  renderProjects(data.projects);
  setupProjectFilters(data.projects);

  // 6. Setup Interactive Calculator
  setupCalculator(data.calculator, cfg);

  // 7. Render Testimonials & Guarantees & FAQs

  renderGuarantees(data.guarantees);
  renderFaqs(data.faqs);

  // 8. Setup Contact & WhatsApp Lead Generators
  setupContactForm(cfg);


  // 9. Initialize Lucide Icons if available
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/* ========================================================
   Theme Switcher (Dark/Light)
   ======================================================== */
function initTheme() {
  let savedTheme = "dark"; try { savedTheme = localStorage.getItem("mz702_theme") || "dark"; } catch {}
  const html = document.documentElement;
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const themeIcon = document.getElementById("theme-icon");

  if (savedTheme === "dark") {
    html.classList.add("dark");
    if (themeIcon) themeIcon.setAttribute("data-lucide", "sun");
  } else {
    html.classList.remove("dark");
    if (themeIcon) themeIcon.setAttribute("data-lucide", "moon");
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isDark = html.classList.toggle("dark");
      try { localStorage.setItem("mz702_theme", isDark ? "dark" : "light"); } catch {}
      if (themeIcon) {
        themeToggleBtn.innerHTML = `<i id="theme-icon" data-lucide="${isDark ? "sun" : "moon"}" class="w-5 h-5"></i>`;
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }
}

/* ========================================================
   Render Hero & Header Stats
   ======================================================== */
function renderHero(cfg) {
  // Brand Names & Titles
  const brandElems = document.querySelectorAll(".site-brand-name");
  brandElems.forEach(el => el.textContent = cfg.siteName);

  const statusBadge = document.getElementById("hero-status-badge");
  if (statusBadge) statusBadge.textContent = cfg.statusBadge;

  const heroHeadline = document.getElementById("hero-headline");
  if (heroHeadline) heroHeadline.innerHTML = cfg.heroHeadline;

  const heroSub = document.getElementById("hero-subheadline");
  if (heroSub) heroSub.textContent = cfg.heroSubheadline;

  // Stats Counters
  const statExp = document.getElementById("stat-exp");
  

  const statProjects = document.getElementById("stat-projects");
  

  const statClients = document.getElementById("stat-clients");
  

  const statSatisfaction = document.getElementById("stat-satisfaction");
  

  // Owner Name in Footer
  const ownerNameElem = document.getElementById("footer-owner-name");
  if (ownerNameElem) ownerNameElem.textContent = cfg.ownerName;
}

/* ========================================================
   Render Services
   ======================================================== */
function renderServices(services, currency) {
  const container = document.getElementById("services-grid");
  if (!container) return;

  container.innerHTML = services.map(svc => `
    <div class="glass-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between relative group overflow-hidden border border-slate-200 dark:border-slate-800">
      <!-- Glow effect on hover -->
      <div class="absolute -top-16 -right-16 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
      
      <div>
        <div class="flex items-center justify-between mb-4">
          <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-xl">
            <i data-lucide="${svc.icon || 'code'}"></i>
          </div>
          <span class="text-xs font-semibold px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            ${svc.badge}
          </span>
        </div>

        <h3 class="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-400 transition-colors">
          ${svc.title}
        </h3>
        <p class="text-xs text-slate-400 dark:text-slate-500 mb-4 font-mono font-medium">${svc.titleEn}</p>
        
        <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
          ${svc.description}
        </p>

        <div class="space-y-2 mb-6">
          ${svc.benefits.map(b => `
            <div class="flex items-start text-xs text-slate-700 dark:text-slate-300">
              <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400 ml-2 mt-0.5 shrink-0"></i>
              <span>${b}</span>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <div>
          <span class="text-xs text-slate-400 block">يبدأ الاستثمار من:</span>
          <span class="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">${svc.startingPrice} ${currency}</span>
        </div>
        <a href="#calculator" class="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 transition-all">
          احسب التكلفة
        </a>
      </div>
    </div>
  `).join("");
}

/* ========================================================
   Render Projects & Setup Filter System
   ======================================================== */
function renderProjects(projects, activeCategory = "all") {
  const container = document.getElementById("projects-grid");
  if (!container) return;

  const filtered = activeCategory === "all" 
    ? projects 
    : projects.filter(p => p.category === activeCategory);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400">
        <i data-lucide="folder-search" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
        <p>لا توجد مشاريع في هذا التصنيف حالياً.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="glass-card rounded-2xl overflow-hidden group cursor-pointer border border-slate-200 dark:border-slate-800 flex flex-col justify-between" role="button" tabindex="0" aria-label="تفاصيل ${p.title}" onclick="openProjectModal('${p.id}')" onkeydown="if(event.target===this && (event.key==='Enter'||event.key===' ')){event.preventDefault();openProjectModal('${p.id}')}">
      <!-- Project Image / Mockup Preview -->
      <div class="relative w-full h-56 bg-slate-900 overflow-hidden">
        <img src="${p.image}" alt="${p.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
        
        <!-- Category & Year Badges -->
        <div class="absolute top-4 right-4 flex items-center gap-2">
          <span class="text-xs font-bold px-3 py-1 rounded-full ${p.isWorkingLive ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/40 shadow-lg' : 'bg-slate-900/80 text-blue-400 border border-blue-500/30'} backdrop-blur-md">
            ${p.statusPill || p.categoryLabel}
          </span>
        </div>

        <div class="absolute bottom-3 right-4 left-4 flex items-center justify-between text-xs text-slate-300">
          <span class="font-medium text-white">${p.client}</span>
          <span class="bg-black/60 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">${p.year}</span>
        </div>
      </div>

      <!-- Project Content -->
      <div class="p-6 flex-1 flex flex-col justify-between">
        <div>
          <h4 class="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-amber-400 transition-colors flex items-center justify-between">
            <span>${p.title}</span>
            <i data-lucide="arrow-up-left" class="w-4 h-4 text-slate-400 group-hover:text-amber-400 group-hover:-translate-x-1 transition-all"></i>
          </h4>
          
          <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
            ${p.shortDesc}
          </p>

          <!-- Key Metrics Pills -->
          <div class="grid grid-cols-2 gap-2 mb-4 bg-slate-100 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            ${p.metrics.slice(0, 2).map(m => `
              <div class="text-center">
                <span class="text-sm font-bold text-emerald-500 dark:text-emerald-400 font-mono block">${m.value}</span>
                <span class="text-[10px] text-slate-500 dark:text-slate-400 block">${m.label}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Tags & Live Action Button -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div class="flex flex-wrap gap-1">
            ${p.tags.slice(0, 3).map(t => `
              <span class="text-[10px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                ${t}
              </span>
            `).join("")}
          </div>
          ${p.liveUrl && p.liveUrl.startsWith('http') ? `
            <a href="${p.liveUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/30 transition-all hover:scale-105" title="فتح التطبيق الحي في نافذة جديدة">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
              <span>فتح النسخة الحالية ↗</span>
            </a>
          ` : `
            <span class="text-[11px] text-blue-400 font-medium flex items-center gap-1">
              <span>تفاصيل</span>
              <i data-lucide="chevron-left" class="w-3 h-3"></i>
            </span>
          `}
        </div>
      </div>
    </div>
  `).join("");

  if (window.lucide) window.lucide.createIcons();
}

function setupProjectFilters(projects) {
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const category = btn.getAttribute("data-filter");
      renderProjects(projects, category);
    });
  });
}

/* ========================================================
   Interactive Project Case Study Modal
   ======================================================== */
window.openProjectModal = function(projectId) {
  const data = loadSiteData();
  const project = data.projects.find(p => p.id === projectId);
  if (!project) return;

  const modal = document.getElementById("project-modal");
  const modalContent = document.getElementById("project-modal-content");
  if (!modal || !modalContent) return;

  modalContent.innerHTML = `
    <!-- Modal Header -->
    <div class="relative w-full h-64 sm:h-80 bg-slate-950 overflow-hidden rounded-t-2xl">
      <img src="${project.image}" alt="${project.title}" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
      
      <button aria-label="إغلاق تفاصيل المشروع" onclick="closeProjectModal()" class="absolute top-4 left-4 w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md text-white flex items-center justify-center hover:bg-rose-600 transition-colors z-20">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>

      <div class="absolute bottom-6 right-6 left-6 text-white">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs px-2.5 py-1 rounded-full bg-blue-600 font-semibold">${project.categoryLabel}</span>
          <span class="text-xs text-slate-300">${project.client}</span>
        </div>
        <h3 class="text-2xl sm:text-3xl font-extrabold">${project.title}</h3>
      </div>
    </div>

    <!-- Modal Body -->
    <div class="p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-200">
      
      <!-- Metrics Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20">
        ${project.metrics.map(m => `
          <div class="text-center p-2">
            <div class="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono mb-1">${m.value}</div>
            <div class="text-xs text-slate-600 dark:text-slate-400 font-medium">${m.label}</div>
          </div>
        `).join("")}
      </div>

      <!-- Overview -->
      <div>
        <h4 class="text-base font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          <i data-lucide="info" class="w-4 h-4 text-blue-500"></i>
          نظرة عامة على المشروع
        </h4>
        <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          ${project.fullDesc}
        </p>
      </div>

      <!-- Challenge & Solution -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
          <h5 class="text-sm font-bold text-rose-600 dark:text-rose-400 mb-2 flex items-center gap-2">
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
            التحدي والمشكلة
          </h5>
          <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-300">${project.challenge}</p>
        </div>

        <div class="p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
          <h5 class="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-2">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            اتجاه التطوير
          </h5>
          <p class="text-xs leading-relaxed text-slate-600 dark:text-slate-300">${project.solution}</p>
        </div>
      </div>

      <!-- Tech Stack -->
      <div>
        <h4 class="text-xs font-bold text-slate-400 mb-2 font-mono">التقنيات والأدوات المستخدمة:</h4>
        <div class="flex flex-wrap gap-2">
          ${project.tags.map(t => `
            <span class="text-xs px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-700">
              #${t}
            </span>
          `).join("")}
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        ${project.liveUrl && project.liveUrl.startsWith('http') ? `
          <a href="${project.liveUrl}" target="_blank" rel="noopener noreferrer" class="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all">
            <i data-lucide="external-link" class="w-4 h-4"></i>
            <span>زيارة النسخة الحالية ↗</span>
          </a>
        ` : ''}

        <a href="#contact" onclick="closeProjectModal()" class="py-3 px-6 rounded-xl bg-blue-600 text-white font-bold text-sm">اطلب مشروعاً مشابهاً</a>

        <button aria-label="إغلاق تفاصيل المشروع" onclick="closeProjectModal()" class="py-3 px-5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
          إغلاق
        </button>
      </div>
    </div>
  `;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";
  if (window.lucide) window.lucide.createIcons();
};

window.closeProjectModal = function() {
  const modal = document.getElementById("project-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.style.overflow = "auto";
};

/* ========================================================
   Interactive Project Cost Calculator
   ======================================================== */
function setupCalculator(calcConfig, siteConfig) {
  const typeContainer = document.getElementById("calc-types-container");
  const addonContainer = document.getElementById("calc-addons-container");
  const estimatedPriceElem = document.getElementById("calc-total-price");
  const estimatedDaysElem = document.getElementById("calc-total-days");
  const whatsappQuoteBtn = document.getElementById("calc-whatsapp-btn");

  if (!typeContainer || !addonContainer) return;

  // Render Project Types Radio buttons
  typeContainer.innerHTML = calcConfig.projectTypes.map((type, idx) => `
    <label class="relative flex items-center p-4 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-all bg-white/50 dark:bg-slate-900/40">
      <input type="radio" name="project_type" value="${type.id}" ${idx === 0 ? "checked" : ""} class="calc-radio sr-only">
      <div class="flex-1">
        <div class="font-bold text-sm text-slate-900 dark:text-white">${type.label}</div>
        <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">المدة التقريبية: ${type.days} أيام عمل</div>
      </div>
      <div class="font-mono font-bold text-blue-600 dark:text-blue-400 text-base">
        ${type.basePrice} ${siteConfig.currency}
      </div>
    </label>
  `).join("");

  // Render Addon Checkboxes
  addonContainer.innerHTML = calcConfig.addonFeatures.map(addon => `
    <label class="relative flex items-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-blue-500 transition-all bg-white/50 dark:bg-slate-900/40">
      <input type="checkbox" name="project_addon" value="${addon.id}" class="calc-checkbox w-4 h-4 text-blue-600 rounded mr-2">
      <div class="flex-1 text-xs font-medium text-slate-700 dark:text-slate-300">${addon.label}</div>
      <div class="font-mono text-xs text-slate-500 font-bold">+${addon.price} ${siteConfig.currency}</div>
    </label>
  `).join("");

  function calculate() {
    const selectedTypeVal = document.querySelector('input[name="project_type"]:checked')?.value;
    const selectedType = calcConfig.projectTypes.find(t => t.id === selectedTypeVal) || calcConfig.projectTypes[0];

    let totalPrice = selectedType.basePrice;
    let totalDays = selectedType.days;

    const checkedAddons = [];
    document.querySelectorAll('input[name="project_addon"]:checked').forEach(cb => {
      const addon = calcConfig.addonFeatures.find(a => a.id === cb.value);
      if (addon) {
        totalPrice += addon.price;
        checkedAddons.push(addon);
      }
    });

    const isFast = document.querySelector('input[name="delivery_speed"]:checked')?.value === "fast";
    if (isFast) {
      totalPrice = Math.round(totalPrice * 1.25 * 100) / 100;
      totalDays = Math.max(3, Math.round(totalDays * 0.6));
    }

    if (estimatedPriceElem) estimatedPriceElem.textContent = `${totalPrice} ${siteConfig.currency}`;
    if (estimatedDaysElem) estimatedDaysElem.textContent = `${totalDays} أيام`;

    // Prepare WhatsApp Message
    const msgText = `مرحباً MZ Solutions، لقد قمت بحساب تقدير لمشروعي عبر حاسبة موقعك:
- نوع المشروع: ${selectedType.label}
- الميزات المختارة: ${checkedAddons.length > 0 ? checkedAddons.map(a => a.label).join(" + ") : "الأساسية"}
- سرعة التسليم: ${isFast ? "مستعجل فائق السرعة" : "عادي"}
- التقدير التلقائي: ${totalPrice} ${siteConfig.currency} (المدة: ${totalDays} أيام)

أرغب في بدء العمل ومناقشة التفاصيل!`;

    if (whatsappQuoteBtn) {
      whatsappQuoteBtn.href = "#contact";
      whatsappQuoteBtn.onclick = () => { const field=document.getElementById("lead-details"); field.value=msgText; field.dispatchEvent(new Event("input",{bubbles:true})); };
    }
  }

  // Attach change listeners
  document.querySelectorAll('input[name="project_type"], input[name="project_addon"], input[name="delivery_speed"]').forEach(input => {
    input.addEventListener("change", calculate);
  });

  calculate();
}

/* ========================================================
   Render Testimonials, Guarantees & FAQs
   ======================================================== */
function renderTestimonials(testimonials) {
  const container = document.getElementById("testimonials-grid");
  if (!container) return;

  container.innerHTML = testimonials.map(t => `
    <div class="glass-card rounded-2xl p-6 sm:p-8 flex flex-col justify-between border border-slate-200 dark:border-slate-800">
      <div>
        <div class="flex items-center gap-1 text-amber-400 mb-4">
          ${Array(t.rating).fill('<i data-lucide="star" class="w-4 h-4 fill-amber-400"></i>').join("")}
        </div>
        <p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-6 italic">
          "${t.content}"
        </p>
      </div>

      <div class="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <img src="${t.avatar}" alt="${t.name}" class="w-11 h-11 rounded-full border-2 border-blue-500/30 object-cover">
        <div>
          <h5 class="text-sm font-bold text-slate-900 dark:text-white">${t.name}</h5>
          <p class="text-xs text-slate-500 dark:text-slate-400">${t.role}</p>
        </div>
      </div>
    </div>
  `).join("");
}

function renderGuarantees(guarantees) {
  const container = document.getElementById("guarantees-grid");
  if (!container) return;

  container.innerHTML = guarantees.map(g => `
    <div class="p-6 rounded-2xl bg-gradient-to-b from-blue-500/5 to-transparent border border-blue-500/10 flex items-start gap-4">
      <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
        <i data-lucide="${g.icon || 'shield'}"></i>
      </div>
      <div>
        <h4 class="text-base font-bold text-slate-900 dark:text-white mb-1">${g.title}</h4>
        <p class="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">${g.desc}</p>
      </div>
    </div>
  `).join("");
}

function renderFaqs(faqs) {
  const container = document.getElementById("faqs-accordion");
  if (!container) return;

  container.innerHTML = faqs.map((faq, idx) => `
    <div class="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white/40 dark:bg-slate-900/40">
      <button class="w-full p-4 sm:p-5 text-right font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between gap-4 transition-colors hover:text-blue-500" aria-expanded="false" aria-controls="faq-answer-${idx}" onclick="toggleFaq(${idx},this)">
        <span>${faq.q}</span>
        <i data-lucide="chevron-down" id="faq-icon-${idx}" class="w-4 h-4 transition-transform duration-300"></i>
      </button>
      <div id="faq-answer-${idx}" class="hidden p-4 sm:p-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800/60">
        ${faq.a}
      </div>
    </div>
  `).join("");
}

window.toggleFaq = function(idx,button) {
  const ans = document.getElementById(`faq-answer-${idx}`);
  const icon = document.getElementById(`faq-icon-${idx}`);
  if (!ans) return;

  const isHidden = ans.classList.contains("hidden");
  button?.setAttribute("aria-expanded",String(isHidden));
  ans.classList.toggle("hidden", !isHidden);
  if (icon) icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
};

/* ========================================================
   Contact Form & Floating WhatsApp Leads
   ======================================================== */
function setupContactForm() {
  const form=document.getElementById('lead-contact-form');
  if(!form)return;
  const status=document.getElementById('lead-status'),button=form.querySelector('button[type="submit"]');
  let busy=false,requestId=crypto.randomUUID(),lastPayload='',finished=false;
  form.addEventListener('input',()=>{if(finished){finished=false;button.disabled=false;button.textContent='إرسال طلب المشروع';status.textContent='';}});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||finished||!form.reportValidity())return;
    const body={name:document.getElementById('lead-name').value.trim(),phone:document.getElementById('lead-phone').value.trim(),email:'',service:document.getElementById('lead-service').value,message:document.getElementById('lead-details').value.trim(),consent:document.getElementById('lead-consent').checked,website:document.getElementById('lead-website').value};
    const payload=JSON.stringify(body);if(lastPayload&&payload!==lastPayload)requestId=crypto.randomUUID();lastPayload=payload;
    busy=true;button.disabled=true;button.textContent='جارٍ حفظ الطلب…';status.textContent='';
    try {
      const config=await fetch('/api/contact-token',{cache:'no-store',signal:AbortSignal.timeout(15000)});
      if(!config.ok)throw Error('استقبال الطلبات غير متاح الآن. حاول لاحقاً أو راسلنا بالبريد.');
      const {token}=await config.json();
      const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,requestId,token}),signal:AbortSignal.timeout(20000)});
      const result=await response.json();
      if(!response.ok||!result.ok||!result.reference)throw Error(result.message||'تعذر تأكيد حفظ الطلب. أعد المحاولة.');
      status.textContent='تم حفظ طلبك بنجاح. رقم المتابعة: '+result.reference+' — احتفظ به عند التواصل معنا. لا تحتاج إلى إعادة الإرسال.';
      status.classList.remove('text-rose-500');status.classList.add('text-emerald-500');
      button.textContent='تم حفظ الطلب';finished=true;status.focus();
    }catch(error){status.textContent=(error.name==='TimeoutError'||error.name==='TypeError')?'تعذر تأكيد الحفظ بسبب الاتصال. احتفظ ببياناتك وأعد المحاولة؛ لن يتكرر الطلب.':error.message;status.classList.remove('text-emerald-500');status.classList.add('text-rose-500');button.textContent='إعادة إرسال الطلب';}
    finally{busy=false;button.disabled=finished;}
  });
}
let modalReturnFocus=null;
const baseOpenProject=window.openProjectModal;
window.openProjectModal=function(id){modalReturnFocus=document.activeElement;baseOpenProject(id);document.querySelector('#project-modal button')?.focus();};
const baseCloseProject=window.closeProjectModal;
window.closeProjectModal=function(){baseCloseProject();modalReturnFocus?.focus();};
document.addEventListener('keydown',e=>{
 const modal=document.getElementById('project-modal');if(!modal||modal.classList.contains('hidden'))return;
 if(e.key==='Escape'){window.closeProjectModal();return;}
 if(e.key==='Tab'){const els=modal.querySelectorAll('a[href],button');const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
document.getElementById('project-modal')?.addEventListener('click',e=>{if(e.target.id==='project-modal')window.closeProjectModal();});
