export function setupTutorialModal() {
  const btn = document.getElementById("btn-tutorial");
  const overlay = document.getElementById("tutorial-overlay");
  const closeBtn = document.getElementById("tutorial-close");
  const titleEl = document.getElementById("tutorial-title");
  const descEl = document.getElementById("tutorial-desc");
  const dotsContainer = document.getElementById("tutorial-dots");
  const textContainer = document.getElementById("tutorial-text-container");
  const imgEl = document.getElementById("tutorial-image");
  const btnBack = document.getElementById("tutorial-btn-back");
  const btnNext = document.getElementById("tutorial-btn-next");
  const nextText = document.getElementById("tutorial-next-text");
  // --- EXPANDED TUTORIAL CONTENT ---
  const slides = [
    {
      title: "Selamat Datang di OOPify!",
      desc: "OOPify adalah Visual Programming Environment untuk membantu mempelajari konsep OOP Java melalui antarmuka blok yang intuitif.",
      imageLight: "./assetTutorial/step1.png",
      imageDark: "./assetTutorial/step1_dark.png",
    },
    {
      title: "Menghubungkan Blok",
      desc: "Drag & drop blok dari panel blok di sebelah kiri ke area workspace. Gabungkan blok-blok layaknya puzzle untuk membangun logika program.",
      imageLight: "./assetTutorial/step2.png",
      imageDark: "./assetTutorial/step2_dark.png",
    },
    {
      title: "Menghapus Blok",
      desc: "Jika terjadi kesalahan, drag & drop blok ke area tempat sampah berwarna merah di pojok kiri bawah, atau klik kanan pada blok dan pilih 'Hapus Blok'.",
      imageLight: "./assetTutorial/step3.png",
      imageDark: "./assetTutorial/step3_dark.png",
    },
    {
      title: "Konversi ke Java",
      desc: "Setelah blok selesai disusun, klik tombol 'Konversi Blok Menjadi Kode' di panel kanan untuk menerjemahkan susunan blok menjadi kode Java.",
      imageLight: "./assetTutorial/step4.png",
      imageDark: "./assetTutorial/step4_dark.png",
    },
    {
      title: "Deteksi Error Pintar",
      desc: "Apabila ada aturan OOP yang dilanggar, blok akan menyala merah dan popover bantuan akan muncul.",
      imageLight: "./assetTutorial/step5.png",
      imageDark: "./assetTutorial/step5_dark.png",
    },
    {
      title: "Bantuan Konsep OOP",
      desc: "Masih bingung dengan konsep OOP? Arahkan kursor (hover) pada blok di panel kiri selama beberapa detik untuk memunculkan penjelasan interaktif.",
      imageLight: "./assetTutorial/step6.png",
      imageDark: "./assetTutorial/step6_dark.png",
    },
    {
      title: "Fitur Ekstra",
      desc: "Klik kanan pada blok atau area workspace kosong untuk memunculkan context menu berisi fitur-fitur yang memudahkan pekerjaan.",
      imageLight: "./assetTutorial/step7.png",
      imageDark: "./assetTutorial/step7_dark.png",
    },
    {
      title: "Simpan & Lanjutkan Nanti",
      desc: "Gunakan menu 'File' untuk menyimpan progress sebagai file JSON atau ekspor menjadi kode Java siap pakai.",
      imageLight: "./assetTutorial/step8.png",
      imageDark: "./assetTutorial/step8_dark.png",
    },
  ];

  // ---> PRELOAD IMAGES
  const preloadedImages = [];
  slides.forEach((slide, i) => {
    preloadedImages[i] = [];
    if (slide.imageLight) {
      const l = new Image();
      l.src = slide.imageLight;
      preloadedImages[i].push(l);
    }
    if (slide.imageDark) {
      const d = new Image();
      d.src = slide.imageDark;
      preloadedImages[i].push(d);
    }
    if (slide.image) {
      const s = new Image();
      s.src = slide.image;
      preloadedImages[i].push(s);
    }
  });

  let currentSlide = 0;
  let isAnimating = false;

  // The 'isInstant' switch completely kills CSS animations when true
  function renderSlide(index, isInstant = false) {
    if (isInstant) {
      isAnimating = false;
      titleEl.textContent = slides[index].title;
      descEl.textContent = slides[index].desc;
      const isDarkMode = document.body.classList.contains("dark-mode");
      imgEl.src = isDarkMode
        ? slides[index].imageDark
        : slides[index].imageLight;

      btnBack.style.display = index === 0 ? "none" : "flex";

      if (index === 0) nextText.textContent = "Pelajari";
      else if (index === slides.length - 1) nextText.textContent = "Mengerti";
      else nextText.textContent = "Next";

      // Completely strip the animation class so it CANNOT animate
      textContainer.className = "slide-center";
      imgEl.style.opacity = "1";

      currentSlide = index;
      updateDots();
      return;
    }

    if (index === currentSlide || isAnimating) return;
    isAnimating = true;

    const directionOut =
      index > currentSlide ? "slide-out-left" : "slide-out-right";
    const directionIn =
      index > currentSlide ? "slide-in-right" : "slide-in-left";

    // Make sure the animation class is added back for regular swiping
    textContainer.className = `tutorial-text-animating ${directionOut}`;
    imgEl.style.opacity = "0";

    setTimeout(() => {
      titleEl.textContent = slides[index].title;
      descEl.textContent = slides[index].desc;

      const isDarkMode = document.body.classList.contains("dark-mode");
      const newSrc =
        (isDarkMode && slides[index].imageDark) ||
        slides[index].imageLight ||
        slides[index].image;

      const tmp = new Image();
      tmp.onload = () => {
        imgEl.src = newSrc;

        btnBack.style.display = index === 0 ? "none" : "flex";
        if (index === 0) nextText.textContent = "Pelajari";
        else if (index === slides.length - 1) nextText.textContent = "Mengerti";
        else nextText.textContent = "Next";

        textContainer.className = directionIn;
        void textContainer.offsetWidth;
        textContainer.className = "tutorial-text-animating slide-center";

        imgEl.style.opacity = "1";

        currentSlide = index;
        updateDots();

        setTimeout(() => {
          isAnimating = false;
        }, 300);
      };

      // start loading the new image (this triggers tmp.onload when done)
      tmp.src = newSrc;
    }, 300);
  }

  function updateDots() {
    dotsContainer.innerHTML = "";
    slides.forEach((_, i) => {
      const dot = document.createElement("div");
      dot.className = `tutorial-dot ${i === currentSlide ? "active" : ""}`;
      dotsContainer.appendChild(dot);
    });
  }

  // Button Listeners
  btnBack.onclick = () => {
    if (!isAnimating && currentSlide > 0) renderSlide(currentSlide - 1);
  };

  btnNext.onclick = () => {
    if (isAnimating) return;
    if (currentSlide < slides.length - 1) {
      renderSlide(currentSlide + 1);
    } else {
      overlay.classList.remove("show"); // Close modal on "Mengerti"
    }
  };

  // Initialization (Instant load on startup)
  renderSlide(0, true);

  // Modal Triggers
  btn.onclick = () => {
    renderSlide(0, true); // Instantly teleport to Step 1 BEFORE showing modal
    overlay.classList.add("show");
  };

  closeBtn.onclick = () => overlay.classList.remove("show");
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.classList.remove("show");
  };
}
