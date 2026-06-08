/* ============================================================================
   Global Sidebar Controller (final, with aesthetic peek + animated close)
   - Mobile (≤1024px): top-left toggle button (hamburger ↔ close) slides <aside> in/out
   - Desktop  (>1024px): <aside> is sticky; uses your built-in #close-btn normally
   - Prevents "double X": on mobile, the in-sidebar #close-btn is hidden; desktop shows it
   - Idempotent: re-running this file won't duplicate UI
   - Enhancements you asked for:
       • When OPEN on mobile and not hovered, the sidebar “peeks” (slides mostly off-screen)
         leaving a slim, animated handle you can hover/click to reveal it again.
       • The burger button gets a subtle transparency/shift animation (only the button, not the sidebar).
       • Aesthetic “X” (close) styling/animation for desktop #close-btn, without breaking behavior.
   ========================================================================== */

(function () {
  'use strict';

  // Avoid double-boot
  if (window.__SIMP_SIDEBAR_BOOTED__) return;
  window.__SIMP_SIDEBAR_BOOTED__ = true;

  // Inject global style override to prevent SweetAlert2 popups/toasts from getting hidden under mobile headers
  // And define premium, uniform compact toast styles
  const swalStyle = document.createElement('style');
  swalStyle.textContent = `
    .swal2-container {
      z-index: 10100 !important;
    }
    /* Premium, uniform, compact toast styles */
    .simp-uniform-toast {
      padding: 8px 12px !important;
      border-radius: 12px !important;
      font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      box-shadow: 0 10px 30px rgba(28, 36, 48, 0.08) !important;
      border: 1px solid rgba(28, 36, 48, 0.05) !important;
      max-width: 360px !important;
      min-height: 44px !important;
      align-items: center !important;
      background: #ffffff !important;
      color: #1c2430 !important;
    }
    .simp-uniform-toast .swal2-title {
      font-size: 0.88rem !important;
      font-weight: 500 !important;
      color: #1c2430 !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1.3 !important;
    }
    .simp-uniform-toast .swal2-icon {
      margin: 0 8px 0 0 !important;
      width: 20px !important;
      height: 20px !important;
      scale: 0.85 !important;
      border: none !important;
    }
    .simp-uniform-toast .swal2-timer-progress-bar {
      background: rgba(28, 36, 48, 0.15) !important;
      height: 3px !important;
    }
    .simp-uniform-toast .swal2-close {
      font-size: 16px !important;
      margin: 0 !important;
      padding: 0 !important;
      align-self: center !important;
      color: rgba(28, 36, 48, 0.5) !important;
    }
    /* Info icon customization to perfectly match Image 6 (no outer circle) */
    .simp-uniform-toast .swal2-icon.swal2-info {
      border: none !important;
    }
    .simp-uniform-toast .swal2-icon.swal2-info .swal2-icon-content {
      color: #0ea5e9 !important;
      font-size: 1.4rem !important;
      font-weight: bold !important;
    }
    /* Globally defer all skeleton wireframes to prevent flashing/blinking on fast loads */
    #loadingSkeleton,
    #settingsSkeleton,
    .skeleton-ui,
    #earnings-skeleton {
      opacity: 0 !important;
      animation: delaySkeletonFadeIn 0.22s ease-in-out 350ms forwards !important;
    }
    @keyframes delaySkeletonFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(swalStyle);

  let activeLoadingToast = null;

  function getLoadingMessageForPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("worker")) return "Loading workers..";
    if (path.includes("settings")) return "Loading your profile..";
    if (path.includes("job") || path.includes("application")) return "Loading applications..";
    if (path.includes("earnings")) return "Loading earnings..";
    if (path.includes("shop")) return "Loading shop..";
    if (path.includes("course")) return "Loading courses..";
    return "Loading page data..";
  }

  function triggerGlobalLoader(SwalObject) {
    if (!SwalObject || activeLoadingToast) return;
    const isPageLoading = document.body && document.body.classList.contains("is-loading");
    if (isPageLoading) {
      activeLoadingToast = SwalObject.fire({
        toast: true,
        position: "top-end",
        icon: "info",
        title: getLoadingMessageForPage(),
        showConfirmButton: false,
        showCloseButton: true,
        timer: undefined, // persistent until close is called
        customClass: {
          popup: "simp-uniform-toast"
        }
      });
    }
  }

  function closeGlobalLoader() {
    if (activeLoadingToast) {
      try {
        activeLoadingToast.close();
      } catch (_) {
        if (window.Swal) window.Swal.close();
      }
      activeLoadingToast = null;
    }
  }

  // Global SweetAlert2 Interceptor to enforce uniform toast positions and compact sizes across all pages
  function setupSwalInterceptor(SwalObject) {
    if (!SwalObject || SwalObject.__SIMP_SWAL_INTERCEPTED__) return;
    SwalObject.__SIMP_SWAL_INTERCEPTED__ = true;

    // Helper to format/override toast options
    function formatToastOptions(options) {
      if (!options || typeof options !== "object") return options;
      if (options.toast) {
        options.position = "top-end"; // Enforce top-right location
        options.showConfirmButton = false;
        if (options.timer === undefined) {
          options.timer = 2200;
        }
        options.timerProgressBar = true;
        
        if (!options.customClass) options.customClass = {};
        const prevClass = options.customClass.popup || "";
        if (!prevClass.includes("simp-uniform-toast")) {
          options.customClass.popup = (prevClass + " simp-uniform-toast").trim();
        }
        
        // Merge title and text to display as a beautiful single line rather than a tall two-line dialog
        if (options.title && options.text) {
          options.title = options.title + ": " + options.text;
          options.text = "";
        }
      }
      return options;
    }

    // 1. Intercept Swal.fire
    const originalFire = SwalObject.fire;
    SwalObject.fire = function (...args) {
      if (args[0] && typeof args[0] === "object") {
        args[0] = formatToastOptions(args[0]);
      }
      return originalFire.apply(this, args);
    };

    // 2. Intercept Swal.mixin
    const originalMixin = SwalObject.mixin;
    SwalObject.mixin = function (mixinOptions) {
      const parentMixin = originalMixin.call(this, formatToastOptions(mixinOptions));
      
      // Also intercept the fire method on the returned mixin instance
      const originalMixinFire = parentMixin.fire;
      parentMixin.fire = function (...args) {
        if (args[0] && typeof args[0] === "object") {
          args[0] = formatToastOptions(args[0]);
        }
        return originalMixinFire.apply(this, args);
      };
      
      return parentMixin;
    };

    // Intercept DOMTokenList methods to close the global loader toast when is-loading class is removed
    const originalRemove = DOMTokenList.prototype.remove;
    DOMTokenList.prototype.remove = function (...tokens) {
      if (this === document.body.classList && tokens.includes("is-loading")) {
        closeGlobalLoader();
      }
      return originalRemove.apply(this, tokens);
    };

    const originalToggle = DOMTokenList.prototype.toggle;
    DOMTokenList.prototype.toggle = function (token, force) {
      if (this === document.body.classList && token === "is-loading") {
        const turnOff = force === false || (force === undefined && document.body.classList.contains("is-loading"));
        if (turnOff) {
          closeGlobalLoader();
        }
      }
      return originalToggle.apply(this, arguments);
    };

    // Automatically trigger loader toast on startup if the page starts loading
    triggerGlobalLoader(SwalObject);
  }

  // Hook immediately if Swal is defined
  if (window.Swal) {
    setupSwalInterceptor(window.Swal);
  }

  // Hook dynamically when page finishes parsing/loading to capture async scripts safely
  document.addEventListener("DOMContentLoaded", () => {
    if (window.Swal) setupSwalInterceptor(window.Swal);
  });
  window.addEventListener("load", () => {
    if (window.Swal) setupSwalInterceptor(window.Swal);
  });

  const MOBILE_BREAKPOINT = 1024;
  const DRAWER_WIDTH_PX   = 210;

  // Peek config (mobile, when OPEN but not hovered)
  const PEEK_OVERLAP_PX   = 22;   // visible part when peeking
  const PEEK_IDLE_DELAY   = 550;  // ms after leaving before peeking

  // BURGER BUTTON transparency/shift (button only)
  const BTN_UNHOVER_OPACITY = 0.55;
  const BTN_HOVER_OPACITY   = 1.0;
  const BTN_UNHOVER_SHIFT   = -6;  // small nudge left when idle
  const BTN_HOVER_SHIFT     = 0;   // normal position on hover/focus/touch
  const TOUCH_HOLD_MS       = 1600;

  // ✨ New: keep-open-until-explicit-close behavior
  // When true, the mobile drawer stays fully open until toggle is pressed again.
  // No auto-close on outside click or Escape, and no auto-peek while open.
  const EXPLICIT_CLOSE_ONLY = true;

  const sideMenu  = document.querySelector('aside');
  const closeBtn  = document.getElementById('close-btn');
  const darkMode  = document.querySelector('.dark-mode');
  const container = document.querySelector('.container'); // optional

  if (!sideMenu) return;

  let isMobile = false;
  let backdrop = null;
  let toggleBtn = null;
  let handle    = null;  // peek handle
  let touchTimer = null;
  let peekTimer  = null;

  /* ------------------------ helpers ------------------------ */
  const debounce = (fn, ms=120) => {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  };

  const css = (el, obj) => { if (!el) return; for (const k in obj) el.style[k] = obj[k]; };

  const isOpen = () => document.body.classList.contains('sidebar-open');

  function clearTimers() { if (peekTimer) { clearTimeout(peekTimer); peekTimer = null; } if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; } }

  function ensureBackdrop() {
    if (backdrop && document.body.contains(backdrop)) return backdrop;
    backdrop = document.createElement('div');
    backdrop.id = 'simp-sidebar-backdrop';
    css(backdrop, {
      position: 'fixed', inset: '0', background: 'rgba(17,24,39,.45)',
      zIndex: '10000', display: 'none', opacity: '0', transition: 'opacity .2s ease'
    });
    // default close-on-click
    backdrop.addEventListener('click', closeSidebar);
    // ✨ New: intercept backdrop clicks when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY) {
      backdrop.addEventListener('click', (e) => {
        if (isMobile && isOpen()) { e.stopPropagation(); e.preventDefault(); }
      }, true); // capture to block before default
    }
    document.body.appendChild(backdrop);
    return backdrop;
  }
  function showBackdrop() { ensureBackdrop(); backdrop.style.display='block'; requestAnimationFrame(()=>backdrop.style.opacity='1'); }
  function hideBackdrop() { if (!backdrop) return; backdrop.style.opacity='0'; setTimeout(()=>{ if (backdrop) backdrop.style.display='none'; }, 200); }

  function ensureToggleBtn() {
    if (toggleBtn && document.body.contains(toggleBtn)) return toggleBtn;
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'simp-sidebar-toggle';
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label','Toggle menu');
    toggleBtn.innerHTML = `<span class="material-icons-sharp" aria-hidden="true">menu</span>`;
    css(toggleBtn, {
      position: 'fixed', top: '12px', left: '12px', width: '42px', height: '42px',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      background: '#fff',
      boxShadow: '0 4px 16px rgba(17,24,39,.10)',
      zIndex: '10002',
      cursor: 'pointer',
      transition: 'opacity .18s ease, transform .18s ease, box-shadow .18s ease, background .18s ease, left .28s ease-in-out'
    });
    toggleBtn.addEventListener('click', () => {
      if (!isMobile) return;
      isOpen() ? closeSidebar(true /*explicit*/) : openSidebar();
    });
    document.body.appendChild(toggleBtn);

    // ——— Burger transparency/shift only on the button (mobile) ———
    const btnHoverLook = () => {
      if (!isMobile) return;
      css(toggleBtn, {
        opacity: String(BTN_HOVER_OPACITY),
        transform: `translateX(${BTN_HOVER_SHIFT}px)`,
        boxShadow: '0 8px 24px rgba(17,24,39,.18)'
      });
    };
    const btnUnhoverLook = () => {
      if (!isMobile) return;
      const shift = isOpen() ? 0 : BTN_UNHOVER_SHIFT;
      css(toggleBtn, {
        opacity: isOpen() ? '1.0' : String(BTN_UNHOVER_OPACITY),
        transform: `translateX(${shift}px)`,
        boxShadow: isOpen() ? '0 8px 24px rgba(17,24,39,.18)' : '0 4px 16px rgba(17,24,39,.10)'
      });
    };
    toggleBtn.__hoverLook = btnHoverLook;
    toggleBtn.__unhoverLook = btnUnhoverLook;

    // pointer/focus/touch handlers
    toggleBtn.addEventListener('mouseenter', btnHoverLook);
    toggleBtn.addEventListener('mouseleave', btnUnhoverLook);
    toggleBtn.addEventListener('focusin',  btnHoverLook);
    toggleBtn.addEventListener('focusout', btnUnhoverLook);
    toggleBtn.addEventListener('touchstart', () => {
      if (!isMobile) return;
      clearTimers();
      btnHoverLook();
      touchTimer = setTimeout(btnUnhoverLook, TOUCH_HOLD_MS);
    }, { passive: true });

    return toggleBtn;
  }
  function setToggleIcon(open) {
    if (!toggleBtn) return;
    const icon = toggleBtn.querySelector('.material-icons-sharp');
    if (icon) {
      icon.style.transition = 'transform .24s ease';
      icon.textContent = open ? 'close' : 'menu';
      icon.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    // Subtle accent when opened
    if (open) {
      toggleBtn.style.background = 'linear-gradient(180deg,#ffffff,#f7fafc)';
      toggleBtn.style.borderColor = '#dbe2ea';
    } else {
      toggleBtn.style.background = '#fff';
      toggleBtn.style.borderColor = '#e5e7eb';
    }
  }
  function showToggleBtn(){ ensureToggleBtn().style.display = 'inline-flex'; }
  function hideToggleBtn(){ if (toggleBtn) toggleBtn.style.display = 'none'; }

  /* ------------------------ Aesthetic desktop close (your #close-btn) ------------------------ */
  function styleDesktopClose() {
    if (!closeBtn) return;
    // Soften the button
    css(closeBtn, {
      borderRadius: '10px',
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'saturate(140%) blur(2px)',
      boxShadow: '0 6px 18px rgba(17,24,39,.08)',
      transition: 'transform .18s ease, box-shadow .18s ease, background .18s ease'
    });
    const ico = closeBtn.querySelector('.material-icons-sharp');
    if (ico) ico.style.transition = 'transform .24s ease';

    const hoverIn = () => {
      css(closeBtn, { background: '#ffffff', boxShadow: '0 10px 26px rgba(17,24,39,.12)', transform: 'translateY(-1px)' });
      if (ico) ico.style.transform = 'rotate(90deg)';
    };
    const hoverOut = () => {
      css(closeBtn, { background: 'rgba(255,255,255,0.85)', boxShadow: '0 6px 18px rgba(17,24,39,.08)', transform: 'none' });
      if (ico) ico.style.transform = 'rotate(0deg)';
    };
    closeBtn.addEventListener('mouseenter', hoverIn);
    closeBtn.addEventListener('mouseleave', hoverOut);
    closeBtn.addEventListener('focusin', hoverIn);
    closeBtn.addEventListener('focusout', hoverOut);
  }

  /* ------------------------ Peek handle (mobile, visible when sidebar is peeking) ------------------------ */
  function ensureHandle() {
    if (handle && document.body.contains(handle)) return handle;
    handle = document.createElement('button');
    handle.id = 'simp-sidebar-handle';
    handle.type = 'button';
    handle.setAttribute('aria-label','Reveal menu');
    handle.innerHTML = `<span class="material-icons-sharp" aria-hidden="true">chevron_right</span>`;
    css(handle, {
      position: 'fixed',
      left: '0px',
      top: '50%',
      transform: 'translate(-50%, -50%)', // half outside screen for a soft "tab" look
      width: '34px',
      height: '86px',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid #d8dee6',
      borderRadius: '999px',
      background: 'linear-gradient(180deg,#ffffff 0%, #f3f6f9 100%)',
      boxShadow: '0 10px 26px rgba(17,24,39,.15)',
      zIndex: '10001',
      cursor: 'pointer',
      transition: 'transform .2s ease, box-shadow .2s ease, opacity .2s ease'
    });
    handle.addEventListener('mouseenter', () => {
      if (!isMobile || !isOpen() || EXPLICIT_CLOSE_ONLY) return;
      css(handle, { transform: 'translate(-40%, -50%)', boxShadow: '0 14px 32px rgba(17,24,39,.22)' });
      revealFull(); // reveal on hover
    });
    handle.addEventListener('mouseleave', () => {
      if (!isMobile || !isOpen() || EXPLICIT_CLOSE_ONLY) return;
      css(handle, { transform: 'translate(-50%, -50%)', boxShadow: '0 10px 26px rgba(17,24,39,.15)' });
    });
    handle.addEventListener('click', () => { if (isMobile && isOpen() && !EXPLICIT_CLOSE_ONLY) revealFull(); });
    document.body.appendChild(handle);
    return handle;
  }
  function showHandle() { if (!EXPLICIT_CLOSE_ONLY) ensureHandle().style.display = 'inline-flex'; }
  function hideHandle() { if (handle) handle.style.display = 'none'; }

  /* ------------------------ Peek / reveal ------------------------ */
  function revealFull() {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    css(sideMenu, { transform: 'translateX(0)' });
    hideHandle();
  }
  function peekSidebar() {
    if (!isMobile || !isOpen() || EXPLICIT_CLOSE_ONLY) return;
    const rect = sideMenu.getBoundingClientRect();
    const width = Math.min(rect.width || DRAWER_WIDTH_PX, window.innerWidth * 0.86);
    const offset = Math.max(0, width - PEEK_OVERLAP_PX);
    css(sideMenu, { transform: `translateX(-${offset}px)` });
    showHandle();
  }

  /* ------------------------ mobile open/close ------------------------ */
  function openSidebar() {
    if (!isMobile) return;
    css(sideMenu, {
      transform: 'translateX(0)',
      visibility: 'visible',
      boxShadow: '0 16px 48px rgba(17,24,39,.22)'
    });
    document.body.classList.add('sidebar-open');
    showBackdrop();
    setToggleIcon(true);
    if (toggleBtn) {
      css(toggleBtn, { left: '154px' });
    }
    if (closeBtn) closeBtn.style.display = 'none'; // prevent double X (mobile)
    toggleBtn?.__hoverLook?.();

    // When EXPLICIT_CLOSE_ONLY is true, do NOT auto-peek
    clearTimers();
    if (!EXPLICIT_CLOSE_ONLY) {
      peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY + 250); // initial idle peek
    }
  }

  // `explicit` param is only used to make intent clear; behavior is the same either way.
  function closeSidebar(/*explicit*/ _explicit) {
    if (!isMobile) return;
    clearTimers();
    css(sideMenu, { transform: 'translateX(-110%)', visibility: 'hidden', boxShadow: 'none' });
    document.body.classList.remove('sidebar-open');
    hideBackdrop();
    setToggleIcon(false);
    hideHandle();
    if (toggleBtn) {
      css(toggleBtn, { left: '12px' });
    }
    if (closeBtn) closeBtn.style.display = ''; // restore desktop default later
    toggleBtn?.__unhoverLook?.();
  }

  function onKeydown(e){
    // ✨ New: ignore Esc auto-close when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY && isMobile && isOpen() && e.key === 'Escape') {
      e.preventDefault();
      return;
    }
    if (isMobile && e.key === 'Escape') closeSidebar();
  }
  function onOutsideClick(e){
    if (!isMobile || !isOpen()) return;
    // ✨ New: ignore outside clicks when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY) return;

    const insideAside = e.target === sideMenu || sideMenu.contains(e.target);
    const onBtn = toggleBtn && (e.target === toggleBtn || toggleBtn.contains(e.target));
    const onBd  = backdrop && e.target === backdrop;
    const onHandle = handle && (e.target === handle || handle.contains(e.target));
    if (!insideAside && !onBtn && !onBd && !onHandle) closeSidebar();
  }

  /* ------------------------ desktop sticky ------------------------ */
  function applyDesktop() {
    document.body.classList.remove('has-mobile-header');
    const mobileHeader = document.getElementById('simp-mobile-header');
    if (mobileHeader) mobileHeader.style.display = 'none';

    // clear mobile inline styles
    css(sideMenu, {
      position:'', left:'', top:'', width:'', maxWidth:'', height:'',
      transform:'', transition:'', zIndex:'', visibility:'', boxShadow:'',
      overflowY:'', overflowX:'', background:''
    });
    hideBackdrop(); hideToggleBtn(); hideHandle();
    if (closeBtn) closeBtn.style.display = ''; // X visible on desktop
    styleDesktopClose(); // make the X look nicer

    const supportsSticky = !!(window.CSS && CSS.supports && CSS.supports('position','sticky'));
    if (container && getComputedStyle(container).alignItems !== 'start') container.style.alignItems = 'start';

    if (supportsSticky) {
      css(sideMenu, { position:'sticky', top:'0', left:'auto', zIndex:'5', height:'100vh', overflowY:'auto' });
    } else {
      // fixed fallback
      const rect = sideMenu.getBoundingClientRect();
      const left = (rect.left + window.scrollX) + 'px';
      const width = rect.width + 'px';
      css(sideMenu, { position:'fixed', top:'0', left, width, height:'100vh', overflow:'auto', zIndex:'5' });
      if (container) {
        const cols = width + ' 1fr';
        container.style.gridTemplateColumns = cols;
        container.style.alignItems = 'start';
      }
    }
  }

  function ensureMobileHeader() {
    let mobileHeader = document.getElementById('simp-mobile-header');
    if (mobileHeader) {
      mobileHeader.style.display = 'flex';
      
      // Update title text in case it changed or for different pages
      const titleEl = document.getElementById('simp-mobile-header-title');
      if (titleEl) {
        let titleText = '';
        const activeLink = sideMenu.querySelector('.sidebar a.active h3');
        if (activeLink) {
          titleText = activeLink.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (!titleText) {
          titleText = document.title
            .replace(/^(Admin|Installer|Customer|Client)\s*-\s*/i, '')
            .trim();
        }
        titleEl.textContent = titleText;
      }
      return mobileHeader;
    }

    mobileHeader = document.createElement('div');
    mobileHeader.id = 'simp-mobile-header';
    
    // Style the mobile header bar
    css(mobileHeader, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '4.6rem',
      background: '#fff',
      borderBottom: '1px solid rgba(132, 139, 200, 0.12)',
      boxShadow: '0 4px 20px rgba(148, 163, 184, 0.06)',
      zIndex: '10000',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1rem',
      boxSizing: 'border-box'
    });

    // Create the page title
    const titleEl = document.createElement('h1');
    titleEl.id = 'simp-mobile-header-title';
    
    // Extract the title text
    let titleText = '';
    // 1. Try to find the active sidebar link text
    const activeLink = sideMenu.querySelector('.sidebar a.active h3');
    if (activeLink) {
      titleText = activeLink.innerText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // 2. Fallback to document title
    if (!titleText) {
      titleText = document.title
        .replace(/^(Admin|Installer|Customer|Client)\s*-\s*/i, '')
        .trim();
    }
    titleEl.textContent = titleText;
    
    css(titleEl, {
      fontSize: '1.25rem',
      fontWeight: '700',
      color: '#1e293b',
      margin: '0 0 0 3.8rem',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    });

    mobileHeader.appendChild(titleEl);

    // Try to find profile photo and append to the far right if present
    const originalProfileImg = document.querySelector('.profile-photo img, .profile img, .avatar img');
    if (originalProfileImg) {
      const profileContainer = document.createElement('div');
      profileContainer.id = 'simp-mobile-header-profile';
      css(profileContainer, {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer'
      });
      
      const clonedProfile = document.createElement('img');
      clonedProfile.id = 'simp-mobile-header-profile-img';
      clonedProfile.src = originalProfileImg.src;
      clonedProfile.alt = 'Profile photo';
      css(clonedProfile, {
        width: '2.4rem',
        height: '2.4rem',
        borderRadius: '50%',
        objectFit: 'cover',
        border: '1px solid rgba(132, 139, 200, 0.2)'
      });
      profileContainer.appendChild(clonedProfile);
      
      // Link click to settings if clicked
      profileContainer.addEventListener('click', () => {
        window.location.href = 'settings.html';
      });
      
      mobileHeader.appendChild(profileContainer);

      // Mutation observer to mirror the dynamic initials or profile photo loading
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'src') {
            clonedProfile.src = originalProfileImg.src;
          }
        });
      });
      observer.observe(originalProfileImg, { attributes: true });
    }

    document.body.appendChild(mobileHeader);
    return mobileHeader;
  }

  /* ------------------------ mobile setup ------------------------ */
  function applyMobile() {
    document.body.classList.add('has-mobile-header');
    // baseline off-canvas styles
    css(sideMenu, {
      position:'fixed', left:'0', top:'0', height:'100dvh',
      width: DRAWER_WIDTH_PX+'px', maxWidth:'86vw',
      background:'#fff',
      transform:'translateX(-110%)',
      transition:'transform .32s ease, box-shadow .28s ease, visibility .28s ease',
      zIndex:'10001', visibility:'hidden', overflowY:'auto', overflowX:'hidden'
    });
    ensureBackdrop();
    ensureHandle();
    showToggleBtn();
    setToggleIcon(false);
    if (closeBtn) closeBtn.style.display = 'none'; // prevent double X
    ensureMobileHeader();
    requestAnimationFrame(()=> toggleBtn?.__unhoverLook?.());
  }

  /* ------------------------ responsive switch ------------------------ */
  function syncMode() {
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const nextMobile = vw <= MOBILE_BREAKPOINT;
    if (nextMobile === isMobile) return;

    isMobile = nextMobile;
    document.body.classList.remove('sidebar-open'); // reset state
    clearTimers();

    if (isMobile) {
      applyMobile();
      hideBackdrop();
    } else {
      applyDesktop();
    }
  }

  /* ------------------------ events ------------------------ */
  window.addEventListener('resize', debounce(syncMode, 120));
  window.addEventListener('orientationchange', debounce(syncMode, 120));
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('click', onOutsideClick);

  // Keep your dark-mode hook (if present)
  if (darkMode) {
    darkMode.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode-variables');
      const s1 = darkMode.querySelector('span:nth-child(1)');
      const s2 = darkMode.querySelector('span:nth-child(2)');
      s1 && s1.classList.toggle('active');
      s2 && s2.classList.toggle('active');
    });
  }

  // Also close when a sidebar link is clicked (mobile)
  sideMenu.addEventListener('click', (e) => {
    if (!isMobile) return;
    const a = e.target.closest('a');
    // ✨ New: don't auto-close on link click when explicit-close-only is on
    if (EXPLICIT_CLOSE_ONLY) return;
    if (a && a.getAttribute('href')) closeSidebar();
  });

  // Sidebar hover logic to peek/reveal (mobile only)
  sideMenu.addEventListener('mouseenter', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    // If explicit-close-only, keep it fully open already; still call revealFull to ensure full state
    revealFull();
  });
  sideMenu.addEventListener('mouseleave', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    if (!EXPLICIT_CLOSE_ONLY) {
      peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY);
    }
  });
  sideMenu.addEventListener('focusin', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    revealFull();
  });
  sideMenu.addEventListener('focusout', (e) => {
    if (!isMobile || !isOpen()) return;
    if (!sideMenu.contains(e.relatedTarget)) {
      clearTimers();
      if (!EXPLICIT_CLOSE_ONLY) {
        peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY);
      }
    }
  });
  sideMenu.addEventListener('touchstart', () => {
    if (!isMobile || !isOpen()) return;
    clearTimers();
    revealFull();
    // auto-peek again after some idle time (disabled when explicit-close-only)
    if (!EXPLICIT_CLOSE_ONLY) {
      peekTimer = setTimeout(peekSidebar, PEEK_IDLE_DELAY + 400);
    }
  }, { passive: true });

  // Boot
  syncMode();
  if (!isMobile) applyDesktop();
  // Ensure aside is not display:none from page CSS; drawer hides via transform
  sideMenu.style.display = 'block';
})();

