document.addEventListener('DOMContentLoaded', () => {
  // Mobile Nav Toggle
  const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  
  if (mobileNavToggle && navLinks) {
    mobileNavToggle.addEventListener('click', () => {
      mobileNavToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close mobile nav when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  // Header Scroll Effect
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.style.padding = '0.75rem 0';
      header.style.backgroundColor = 'rgba(11, 15, 25, 0.9)';
      header.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
    } else {
      header.style.padding = '1.25rem 0';
      header.style.backgroundColor = 'rgba(11, 15, 25, 0.7)';
      header.style.boxShadow = 'none';
    }
  });

  // Dynamic Scroll Spy for Navigation Links
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;
      if (pageYOffset >= sectionTop - 150) {
        current = section.getAttribute('id');
      }
    });

    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('href').includes(current) && current !== '') {
        item.classList.add('active');
      }
    });
  });
});
