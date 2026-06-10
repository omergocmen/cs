/* =========================================
   Ömer Göçmen — Portfolio & Channel Site
   JavaScript
   ========================================= */

// ============== YouTube Video Data ==============
const videos = [
    {
        title: "Use Claude, Qwen, and GLM for Free! A New Rival to Antigravity",
        url: "https://www.youtube.com/watch?v=jI0pO1w374Q",
        videoId: "jI0pO1w374Q"
    },
    {
        title: "Effortlessly Overcome AI Limitations! Use All Models from One Place",
        url: "https://www.youtube.com/watch?v=wtX4VLev-nY",
        videoId: "wtX4VLev-nY"
    },
    {
        title: "Gemini Conductor: Google's New AI Tool Ends Vibe Coding!",
        url: "https://www.youtube.com/watch?v=RAH_xQIo7z0",
        videoId: "RAH_xQIo7z0"
    },
    {
        title: "I Created a Product, Website, and Ad with a Single Prompt",
        url: "https://www.youtube.com/watch?v=24jOxiGI01U",
        videoId: "24jOxiGI01U"
    },
    {
        title: "This Free Setup Makes Claude Soar! AI Agent That Browses the Web",
        url: "https://www.youtube.com/watch?v=QhlwiLrQq2o",
        videoId: "QhlwiLrQq2o"
    },
    {
        title: "This Isn't Just One AI, It's a Team of Agents at Your Command",
        url: "https://www.youtube.com/watch?v=s82g7BfeldI",
        videoId: "s82g7BfeldI"
    },
    {
        title: "OpenClaw'ı Çöpe Atın! Sadece Telefonla Tüm İşleri Yapan Yapay Zeka",
        url: "https://www.youtube.com/watch?v=IcR_BKY6_yw",
        videoId: "IcR_BKY6_yw"
    },
    {
        title: "Automatically Upload Videos to YouTube — AI Video Factory with n8n",
        url: "https://www.youtube.com/watch?v=LxIbwRcgnqQ",
        videoId: "LxIbwRcgnqQ"
    },
    {
        title: "n8n + V0 ile Yapay Zeka Tabanlı Uygulamalar Yap | Hiç Kod Yok",
        url: "https://www.youtube.com/watch?v=NWTeVW7JiNM",
        videoId: "NWTeVW7JiNM"
    },
    {
        title: "BrowserAct + n8n: Exploit All Websites From Your Browser",
        url: "https://www.youtube.com/watch?v=SzE7mghgpSo",
        videoId: "SzE7mghgpSo"
    },
    {
        title: "This AI Does All the Work for You! (I tried Abacus CoWork)",
        url: "https://www.youtube.com/watch?v=eTYjdUh1yqs",
        videoId: "eTYjdUh1yqs"
    },
    {
        title: "Install This Instead of OpenClaw! AI Agent That Manages Your Work",
        url: "https://www.youtube.com/watch?v=nwF4wCvmNSc",
        videoId: "nwF4wCvmNSc"
    },
    {
        title: "n8n's New Power: AI Workflow Builder Instantly Builds Agents",
        url: "https://www.youtube.com/watch?v=x06fqtzCoY4",
        videoId: "x06fqtzCoY4"
    },
    {
        title: "Yapay Zekayla Viral YouTube Otomasyonu (Ücretsiz n8n Workflow)",
        url: "https://www.youtube.com/watch?v=EcUo2Px1ezU",
        videoId: "EcUo2Px1ezU"
    },
    {
        title: "Creating Popular Videos Free and Easily with Artificial Intelligence",
        url: "https://www.youtube.com/watch?v=gXhVFwzN4_4",
        videoId: "gXhVFwzN4_4"
    }
];

// ============== Typed Text Effect ==============
const typedTextEl = document.getElementById('typedText');
const phrases = [
    'Software Engineer',
    'AI Content Creator',
    'Full-Stack Developer',
    'Automation Enthusiast',
    'Yapay Zeka Anlatıcısı'
];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 100;

function typeEffect() {
    const current = phrases[phraseIndex];

    if (isDeleting) {
        typedTextEl.textContent = current.substring(0, charIndex - 1);
        charIndex--;
        typeSpeed = 50;
    } else {
        typedTextEl.textContent = current.substring(0, charIndex + 1);
        charIndex++;
        typeSpeed = 100;
    }

    if (!isDeleting && charIndex === current.length) {
        isDeleting = true;
        typeSpeed = 2000; // Pause at end
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 500; // Pause before next word
    }

    setTimeout(typeEffect, typeSpeed);
}

// Start typing effect
if (typedTextEl) {
    setTimeout(typeEffect, 1000);
}

// ============== Render YouTube Videos ==============
function renderVideos() {
    const grid = document.getElementById('videosGrid');
    if (!grid) return;

    grid.innerHTML = videos.map((video, index) => `
        <article class="video-card" data-video-id="${video.videoId}" data-index="${index}">
            <div class="video-thumbnail">
                <span class="video-number">#${String(index + 1).padStart(2, '0')}</span>
                <img
                    src="https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg"
                    alt="${video.title}"
                    loading="lazy"
                    onerror="this.src='https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg'"
                />
                <div class="video-overlay">
                    <div class="play-button">
                        <i class="fas fa-play" style="margin-left: 4px;"></i>
                    </div>
                </div>
            </div>
            <div class="video-info">
                <h3 class="video-title">${video.title}</h3>
                <div class="video-meta">
                    <i class="fab fa-youtube"></i>
                    <span>YouTube'da İzle</span>
                </div>
            </div>
        </article>
    `).join('');

    // Attach click listeners for modal
    grid.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const videoId = card.getAttribute('data-video-id');
            openVideoModal(videoId);
        });
    });
}

// ============== Video Modal ==============
const videoModal = document.getElementById('videoModal');
const modalIframe = document.getElementById('modalIframe');
const modalClose = document.getElementById('modalClose');
const modalBackdrop = document.getElementById('modalBackdrop');

function openVideoModal(videoId) {
    if (!videoModal || !modalIframe) return;
    modalIframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    videoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeVideoModal() {
    if (!videoModal || !modalIframe) return;
    videoModal.classList.remove('active');
    modalIframe.src = '';
    document.body.style.overflow = '';
}

if (modalClose) modalClose.addEventListener('click', closeVideoModal);
if (modalBackdrop) modalBackdrop.addEventListener('click', closeVideoModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && videoModal && videoModal.classList.contains('active')) {
        closeVideoModal();
    }
});

// ============== Counter Animation ==============
function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    const duration = 2000;
    const startTime = performance.now();

    function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        el.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        } else {
            el.textContent = target;
        }
    }

    requestAnimationFrame(updateCounter);
}

// ============== Skill Bar Animation ==============
function animateSkillBars() {
    document.querySelectorAll('.skill-item').forEach(item => {
        const level = item.getAttribute('data-level');
        const fill = item.querySelector('.skill-fill');
        if (fill) {
            fill.style.width = level + '%';
        }
    });
}

// ============== Intersection Observer ==============
const observerOptions = {
    threshold: 0.2,
    rootMargin: '0px 0px -50px 0px'
};

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Counters
            if (entry.target.classList.contains('stat-num')) {
                animateCounter(entry.target);
            }
            // Skill bars
            if (entry.target.closest('.skills-wrapper')) {
                animateSkillBars();
            }
            // Timeline items
            if (entry.target.classList.contains('timeline-item')) {
                entry.target.classList.add('visible');
            }
            // Videos (staggered)
            if (entry.target.classList.contains('video-card')) {
                const idx = parseInt(entry.target.getAttribute('data-index'), 10) || 0;
                entry.target.style.transitionDelay = `${(idx % 6) * 80}ms`;
                entry.target.classList.add('visible');
            }

            // Generic fade-up
            if (entry.target.classList.contains('fade-up')) {
                entry.target.classList.add('visible');
            }

            fadeObserver.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe stat numbers
document.querySelectorAll('.stat-num').forEach(el => fadeObserver.observe(el));

// Observe timeline items
document.querySelectorAll('.timeline-item').forEach(el => fadeObserver.observe(el));

// Observe skill section
const skillsSection = document.querySelector('.skills-wrapper');
if (skillsSection) fadeObserver.observe(skillsSection);

// ============== Navbar Scroll Effect ==============
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    if (navbar) {
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    lastScroll = currentScroll;
});

// ============== Active Nav Link on Scroll ==============
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link');

function setActiveNavLink() {
    const scrollPos = window.scrollY + 120;

    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');

        if (scrollPos >= top && scrollPos < top + height) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${id}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}

window.addEventListener('scroll', setActiveNavLink);

// ============== Mobile Menu ==============
const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');

if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu on link click
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

// ============== Scroll to Top ==============
const scrollTopBtn = document.getElementById('scrollTop');

if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 400) {
            scrollTopBtn.classList.add('visible');
        } else {
            scrollTopBtn.classList.remove('visible');
        }
    });

    scrollTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ============== Particles ==============
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;

    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4'];
    const particleCount = window.innerWidth < 768 ? 15 : 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        const size = Math.random() * 4 + 2;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.animationDuration = (Math.random() * 15 + 15) + 's';
        particle.style.animationDelay = (Math.random() * 20) + 's';
        container.appendChild(particle);
    }
}

// ============== Video Card Fade-in ==============
function observeVideoCards() {
    const videoCards = document.querySelectorAll('.video-card');
    videoCards.forEach((card, idx) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        fadeObserver.observe(card);
    });
}

// ============== Footer Year ==============
function setYear() {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// ============== Init ==============
document.addEventListener('DOMContentLoaded', () => {
    renderVideos();
    createParticles();
    setYear();
    setActiveNavLink();

    // Observe video cards after they are rendered
    setTimeout(observeVideoCards, 100);
});

// ============== Smooth scroll for anchor links ==============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
