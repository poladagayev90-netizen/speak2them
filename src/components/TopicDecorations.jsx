import React, { useEffect, useRef } from 'react';

// Maps topic name/keywords to a list of emojis or symbols
const getThemeParticles = (topic) => {
  const t = topic.toLowerCase();
  if (t.includes('travel')) return ['✈️', '☁️', '🌍', '✨'];
  if (t.includes('technology')) return ['0', '1', '💻', '⚡', '✨'];
  if (t.includes('food') || t.includes('culture')) return ['🍕', '🍩', '🍎', '☕'];
  if (t.includes('education') || t.includes('book')) return ['📚', '✏️', '💡', '✨'];
  if (t.includes('health')) return ['🍃', '💧', '🏃', '✨'];
  if (t.includes('environment')) return ['🍂', '🍃', '🌱', '✨'];
  if (t.includes('work') || t.includes('career')) return ['💼', '📈', '✨'];
  if (t.includes('social')) return ['❤️', '👍', '💬', '✨'];
  if (t.includes('money') || t.includes('finance')) return ['💰', '💵', '🪙', '✨'];
  if (t.includes('film') || t.includes('series')) return ['🍿', '🎬', '✨'];
  if (t.includes('music')) return ['🎵', '🎶', '✨'];
  if (t.includes('hobby') || t.includes('free time')) return ['🎨', '🧩', '✨'];
  if (t.includes('fashion') || t.includes('style')) return ['👗', '💎', '✨'];
  if (t.includes('fear') || t.includes('phobia')) return ['👻', '🕸️', '✨'];
  if (t.includes('relationship') || t.includes('friend')) return ['❤️', '💖', '✨'];
  if (t.includes('sport') || t.includes('competition')) return ['⚽', '🏀', '🏆', '✨'];
  if (t.includes('animal') || t.includes('pet')) return ['🐾', '🦴', '✨'];
  if (t.includes('science') || t.includes('space')) return ['🌟', '🚀', '🔭', '✨'];
  if (t.includes('city') || t.includes('country')) return ['🏙️', '🌲', '✨'];
  if (t.includes('language') || t.includes('communication')) return ['💬', '🌐', '✨'];
  if (t.includes('shopping') || t.includes('consumerism')) return ['🛍️', '💳', '✨'];
  if (t.includes('dream') || t.includes('ambition')) return ['✨', '🌟', '💫'];
  if (t.includes('history') || t.includes('past')) return ['⏳', '📜', '✨'];
  if (t.includes('future') || t.includes('prediction')) return ['🔮', '✨', '💫'];
  
  // Default
  return ['✨', '🔹', '🔸'];
};

export default function TopicDecorations({ topic, intensity = 'low' }) {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let particles = [];
    
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    const symbols = getThemeParticles(topic || '');
    // Decorative only — every particle costs save/rotate/fillText/restore per
    // frame on the main thread, right where tab-switch mount work happens.
    const maxParticles = intensity === 'high' ? 14 : 6;
    
    class Particle {
      constructor() {
        this.reset(true);
      }
      
      reset(randomY = false) {
        this.x = Math.random() * canvas.width;
        this.y = randomY ? Math.random() * canvas.height : -50;
        this.size = Math.random() * 16 + 12;
        this.speedY = Math.random() * 1.5 + 0.5;
        this.speedX = Math.random() * 1 - 0.5;
        this.symbol = symbols[Math.floor(Math.random() * symbols.length)];
        this.opacity = Math.random() * 0.4 + 0.2;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 2;
      }
      
      update() {
        this.y += this.speedY;
        this.x += this.speedX;
        this.rotation += this.rotationSpeed;
        
        if (this.y > canvas.height + 50 || this.x < -50 || this.x > canvas.width + 50) {
          this.reset();
        }
      }
      
      draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.font = `${this.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Matrix style for numbers
        if (['0', '1'].includes(this.symbol)) {
          ctx.fillStyle = '#10b981';
        } else {
          ctx.fillStyle = '#7c6ff7';
        }
        
        ctx.fillText(this.symbol, 0, 0);
        ctx.restore();
      }
    }
    
    // Initialize particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push(new Particle());
    }
    
    const animate = () => {
      // Hidden tab: skip drawing entirely, just idle until visible again.
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (particles.length < maxParticles) {
        particles.push(new Particle());
      } else if (particles.length > maxParticles) {
        particles.pop();
      }

      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [topic, intensity]);
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0, // Behind main content
        opacity: intensity === 'high' ? 1 : 0.6,
        transition: 'opacity 1.5s ease-in-out'
      }}
    />
  );
}
