document.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('clash-splash');
    const flash = document.getElementById('splash-flash');
    const bolt = document.getElementById('splash-bolt');
    const title = document.getElementById('splash-title');
    const chars = document.querySelectorAll('.splash-char');
    const navbar = document.getElementById('navbar');

    if (!splash) return;

    // Phase 1: Electric Strike & Flash (0.1s - 0.4s)
    setTimeout(() => {
        bolt.classList.add('active');
        if (flash) flash.classList.add('active');
    }, 100);

    // Phase 2: Electric Burn-In Reveal (0.3s)
    setTimeout(() => {
        title.classList.add('active');
    }, 300);

    // Phase 3: The Shatter (2.5s total duration)
    setTimeout(() => {
        chars.forEach((char, i) => {
            const tx = (Math.random() - 0.5) * 800;
            const ty = (Math.random() - 0.5) * 800;
            const tr = (Math.random() - 0.5) * 1080;
            
            char.style.setProperty('--tx', `${tx}px`);
            char.style.setProperty('--ty', `${ty}px`);
            char.style.setProperty('--tr', `${tr}deg`);
            
            setTimeout(() => {
                char.classList.add('shatter');
            }, i * 25);
        });

        // Phase 4: Main Page Reveal
        document.body.classList.add('main-reveal-active');
        if (navbar) navbar.style.opacity = '1';
        
        // Phase 5: Cleanup
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => { splash.remove(); }, 800);
        }, 600);

    }, 2800);
});
