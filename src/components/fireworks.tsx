'use client'

import { useEffect, useRef } from 'react'

export default function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const particles: { x: number; y: number; vx: number; vy: number; alpha: number; color: string }[] = []
    const colors = ['#fff1c8', '#f6cf79', '#fffaf0', '#e9a4a7']
    let frame = 0
    let bursts = 0
    let lastBurst = 0
    let startedAt = 0
    let width = 0
    let height = 0
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      width = bounds.width
      height = bounds.height
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const burst = () => {
      const x = width * (0.18 + Math.random() * 0.64)
      const y = height * (0.18 + Math.random() * 0.48)
      const count = width < 420 ? 12 : 20
      for (let index = 0; index < count; index++) {
        const angle = (Math.PI * 2 * index) / count
        const speed = 0.7 + Math.random() * 1.8
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
        })
      }
    }

    const draw = (now: number) => {
      if (!startedAt) startedAt = now
      if (bursts < 6 && now - lastBurst >= 600) {
        burst()
        bursts++
        lastBurst = now
      }

      context.clearRect(0, 0, width, height)
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index]
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.018
        particle.alpha -= 0.012
        if (particle.alpha <= 0) {
          particles.splice(index, 1)
          continue
        }
        context.globalAlpha = particle.alpha
        context.fillStyle = particle.color
        context.beginPath()
        context.arc(particle.x, particle.y, 2, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1

      if (now - startedAt < 5200 || particles.length) frame = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="story-fireworks" aria-hidden="true" />
}
