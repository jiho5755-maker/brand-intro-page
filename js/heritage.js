/* ==========================================
   Heritage Page Interactive Features
   ========================================== */

document.addEventListener('DOMContentLoaded', function() {

    // ==========================================
    // 1. Parallax Effect (Hero Section)
    // ==========================================
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            heroSection.style.backgroundPosition = `center ${scrolled * 0.5}px`;
        }
    });

    // ==========================================
    // 2. Achievement Tabs
    // ==========================================
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach((btn) => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');

            // Remove active class from all buttons and update ARIA
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            // Add active to clicked button and update ARIA
            this.classList.add('active');
            this.setAttribute('aria-selected', 'true');

            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            // Show selected tab content
            const selectedContent = document.querySelector(`.tab-content[data-tab-id="${tabId}"]`);
            if (selectedContent) {
                selectedContent.classList.add('active');
            }
        });
    });

    // ==========================================
    // 3. CountUp Animation for Stats
    // ==========================================
    function animateCount(element, target, duration = 2000) {
        let current = 0;
        const increment = target / (duration / 16);
        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            current = Math.floor(target * progress);
            element.textContent = current + '+';

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.textContent = target + '+';
            }
        }

        requestAnimationFrame(animate);
    }

    // Trigger stats animation on scroll
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = document.querySelectorAll('.stat-number');
                statNumbers.forEach(stat => {
                    if (!stat.hasAttribute('data-animated')) {
                        const value = parseInt(stat.getAttribute('data-value'));
                        animateCount(stat, value);
                        stat.setAttribute('data-animated', 'true');
                    }
                });
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.stats-counter');
    if (statsSection) {
        statsObserver.observe(statsSection);
    }

    // ==========================================
    // 4. Book Carousel (Slick) - 메이크샵 최적화
    // ==========================================
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.slick !== 'undefined') {
        jQuery('.book-carousel').slick({
            slidesToShow: 4,
            slidesToScroll: 1,
            infinite: true,
            dots: true,
            arrows: true,
            autoplay: false,
            responsive: [
                {
                    breakpoint: 1200,
                    settings: {
                        slidesToShow: 3,
                        slidesToScroll: 1
                    }
                },
                {
                    breakpoint: 1024,
                    settings: {
                        slidesToShow: 2.5,
                        slidesToScroll: 1
                    }
                },
                {
                    breakpoint: 768,
                    settings: {
                        slidesToShow: 2,
                        slidesToScroll: 1
                    }
                },
                {
                    breakpoint: 640,
                    settings: {
                        slidesToShow: 1.2,
                        slidesToScroll: 1,
                        centerMode: true
                    }
                }
            ]
        });
    }

    // ==========================================
    // 5. Gallery Lightbox (Enhanced)
    // ==========================================
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = lightbox.querySelector('img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    let currentImageIndex = 0;
    let previousFocus = null;

    // Open lightbox
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', function(e) {
            const imgSrc = this.querySelector('img').src;
            const imgAlt = this.querySelector('img').alt;
            lightboxImg.src = imgSrc;
            lightboxImg.alt = imgAlt;
            currentImageIndex = index;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';

            // Store previous focus for restoration
            previousFocus = document.activeElement;
            // Focus on close button for accessibility
            lightboxClose.focus();
        });
    });

    // Close lightbox function
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
        // Restore focus to previous element
        if (previousFocus) {
            previousFocus.focus();
        }
    }

    // Navigate to next/previous image
    function navigateImage(direction) {
        currentImageIndex += direction;
        if (currentImageIndex < 0) currentImageIndex = galleryItems.length - 1;
        if (currentImageIndex >= galleryItems.length) currentImageIndex = 0;

        const newImg = galleryItems[currentImageIndex].querySelector('img');
        lightboxImg.src = newImg.src;
        lightboxImg.alt = newImg.alt;
    }

    lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', function(e) {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // Enhanced keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (!lightbox.classList.contains('active')) return;

        switch(e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowRight':
                navigateImage(1);
                break;
            case 'ArrowLeft':
                navigateImage(-1);
                break;
        }
    });

    // Focus trap inside lightbox
    lightbox.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && lightbox.classList.contains('active')) {
            e.preventDefault();
            lightboxClose.focus();
        }
    });

    // ==========================================
    // 6. Smooth Scroll for Anchor Links
    // ==========================================
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const targetElement = document.querySelector(href);
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop;
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth',
                    });
                }
            }
        });
    });

    // ==========================================
    // 7. Intersection Observer for Fade-in Animations
    // ==========================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
    };

    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-visible');
            }
        });
    }, observerOptions);

    // Observe elements for fade-in animation
    const fadeElements = document.querySelectorAll(
        '.achievement-card, .education-card, .international-card, .timeline-item'
    );
    fadeElements.forEach(el => {
        el.classList.add('fade-in');
        fadeObserver.observe(el);
    });

    // ==========================================
    // 8. Mobile Menu (Optional)
    // ==========================================
    // Add any additional mobile-specific functionality here

    // ==========================================
    // 9. Image Lazy Loading
    // ==========================================
    const images = document.querySelectorAll('img');
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(img => {
            if (img.dataset.src) {
                imageObserver.observe(img);
            }
        });
    }

});

// ==========================================
// Additional CSS for Animations (can also be in CSS file)
// ==========================================
const style = document.createElement('style');
style.textContent = `
    .fade-in {
        opacity: 0;
        transform: translateY(20px);
    }

    .fade-in-visible {
        animation: fadeInUp 0.6s ease-out forwards;
    }

    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style);
