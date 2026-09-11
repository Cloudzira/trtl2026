function renderHotspots(pageNumber) {
    const container = document.getElementById('hotspot-container');
    container.innerHTML = ''; // Bersihkan hotspot halaman sebelumnya
    
    const pageConfig = tartili1Config[pageNumber];
    if (!pageConfig) return;

    pageConfig.forEach(([top, left, width, height, audioFile]) => {
        const hotspot = document.createElement('div');
        hotspot.className = 'sound-block';
        hotspot.style.top = `${top}%`;
        hotspot.style.left = `${left}%`;
        hotspot.style.width = `${width}%`;
        hotspot.style.height = `${height}%`;
        
        hotspot.addEventListener('click', () => {
            playAudio(audioFile);
        });
        
        container.appendChild(hotspot);
    });
}
