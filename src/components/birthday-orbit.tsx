'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type OrbitItem = { mesh: THREE.Object3D; speed: number; phase: number; amplitude: number; originY: number }

export default function BirthdayOrbit() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.z = 10

    scene.add(new THREE.AmbientLight(0xfff2dc, 2.6))
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2)
    keyLight.position.set(4, 5, 6)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0xff8a70, 12, 20)
    rimLight.position.set(-4, -2, 5)
    scene.add(rimLight)

    const group = new THREE.Group()
    scene.add(group)
    const items: OrbitItem[] = []
    const addItem = (mesh: THREE.Object3D, position: [number, number, number], speed: number, amplitude: number) => {
      mesh.position.set(...position)
      group.add(mesh)
      items.push({ mesh, speed, phase: Math.random() * Math.PI * 2, amplitude, originY: position[1] })
    }

    const pearl = new THREE.MeshStandardMaterial({ color: 0xffe0c5, roughness: 0.38 })
    const coral = new THREE.MeshStandardMaterial({ color: 0xff7659, roughness: 0.36 })
    const lilac = new THREE.MeshStandardMaterial({ color: 0xb38ac3, roughness: 0.4 })
    const gold = new THREE.MeshStandardMaterial({ color: 0xf4c96c, roughness: 0.3, metalness: 0.28 })

    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.92, 28, 20), coral)
    balloon.scale.set(0.78, 1.05, 0.78)
    addItem(balloon, [2.15, 1.1, 0.2], 0.7, 0.18)
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), pearl)
    addItem(knot, [2.15, -0.08, 0.2], 0.7, 0.18)

    const gift = new THREE.Group()
    const ribbon = new THREE.MeshStandardMaterial({ color: 0xfff1d2, roughness: 0.45 })
    gift.add(
      new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.18, 1.15), lilac),
      new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.21, 1.17), ribbon),
      new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.18, 1.17), ribbon),
    )
    const bowLeft = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.09, 10, 18), ribbon)
    const bowRight = bowLeft.clone()
    bowLeft.position.set(-0.23, 0.68, 0)
    bowRight.position.set(0.23, 0.68, 0)
    gift.add(bowLeft, bowRight)
    addItem(gift, [-2.25, -1.5, 0], 0.52, 0.15)

    for (let index = 0; index < 24; index++) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(index % 3 === 0 ? 0.11 : 0.065), index % 2 ? gold : pearl)
      const angle = index * 2.4
      const radius = 2.1 + (index % 6) * 0.42
      addItem(star, [Math.cos(angle) * radius, Math.sin(angle) * radius, -1 - (index % 4) * 0.3], 0.35 + (index % 5) * 0.09, 0.08 + (index % 3) * 0.035)
    }

    const pointer = { x: 0, y: 0 }
    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointer.y = -((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const clock = new THREE.Clock()
    let frame = 0
    const render = () => {
      const elapsed = reducedMotion.matches ? 0 : clock.getElapsedTime()
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, pointer.x * 0.18, 0.025)
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, -pointer.y * 0.12, 0.025)
      items.forEach(({ mesh, speed, phase, amplitude, originY }) => {
        mesh.position.y = originY + Math.sin(elapsed * speed + phase) * amplitude
        mesh.rotation.x += reducedMotion.matches ? 0 : speed * 0.004
        mesh.rotation.y += reducedMotion.matches ? 0 : speed * 0.007
      })
      renderer.render(scene, camera)
      frame = requestAnimationFrame(render)
    }
    render()

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach(material => material.dispose())
        }
      })
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className="birthday-orbit" aria-hidden="true" />
}
