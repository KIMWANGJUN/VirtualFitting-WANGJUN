"use client"

import { useState, useContext, useEffect } from "react"
import { useNavigate, useLocation, useParams } from "react-router-dom"
import { ThemeContext } from "../../context/ThemeContext"
import Header from "../../components/Header/Header"
import Footer from "../../components/Footer/Footer"
import { User, Shirt, Heart, ImageIcon, Camera, Upload, Palette, ChevronDown, Download } from 'lucide-react'
import { isLoggedIn } from "../../api/auth"
import { getMyLikedClothes } from "../../api/likedClothes"
import { startVirtualFitting } from "../../api/virtual_fitting"
import styles from "./VirtualFittingPage.module.css"
import {
  getPersonImages,
  getPersonImageUrl,
  handlePersonImageError,
  filterValidPersonImages,
} from "../../api/personImages"
import {
  getUserClothes,
  getClothingImageUrl,
  handleClothingImageError,
  VALID_CATEGORIES,
} from "../../api/userClothesAPI"

import { ShirtIcon } from 'lucide-react'

const VirtualFittingPage = () => {
  const { darkMode } = useContext(ThemeContext)
  const navigate = useNavigate()
  const location = useLocation()
  const { clothingId } = useParams() // URL 파라미터에서 clothingId 받기
  
  const [selectedPersonImage, setSelectedPersonImage] = useState(null)
  const [selectedClothingImage, setSelectedClothingImage] = useState(null)
  const [selectedClothingData, setSelectedClothingData] = useState(null)
  const [activeTab, setActiveTab] = useState("liked")
  const [likedClothing, setLikedClothing] = useState([])
  const [likedClothingLoading, setLikedClothingLoading] = useState(false)
  const [personImageFit, setPersonImageFit] = useState("contain")
  const [clothingImageFit, setClothingImageFit] = useState("contain")
  const [personImages, setPersonImages] = useState([])
  const [personImagesLoading, setPersonImagesLoading] = useState(false)
  const [myClosetClothes, setMyClosetClothes] = useState([])
  const [myClosetLoading, setMyClosetLoading] = useState(false)
  

  
  // 카테고리 관련 상태
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [showCategorySelector, setShowCategorySelector] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // 🔥 간단한 상태만 유지
  const [isConverting, setIsConverting] = useState(false)
  const [showDownloadHelper, setShowDownloadHelper] = useState(false)
  const [failedImageUrl, setFailedImageUrl] = useState("")
  // 쿼리로 넘어온 personImage 프리선택 처리
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const personUrl = params.get('personImageUrl')
    if (personUrl) {
      setSelectedPersonImage(personUrl)
      setActiveTab('images')
    }
  }, [location.search])

  // 카테고리 매핑 함수
  const mapCategoryToNumber = (categoryName) => {
    if (!categoryName) return null
    
    const category = categoryName.toLowerCase()
    
    // 상체 (0)
    if (category.includes('상의') || 
        category.includes('셔츠') || 
        category.includes('티셔츠') || 
        category.includes('블라우스') || 
        category.includes('탑') || 
        category.includes('아우터') || 
        category.includes('재킷') || 
        category.includes('코트') || 
        category.includes('가디건') || 
        category.includes('후드') || 
        category.includes('맨투맨') || 
        category.includes('니트')) {
      return 0
    }
    
    // 하체 (1)
    if (category.includes('하의') || 
        category.includes('바지') || 
        category.includes('팬츠') || 
        category.includes('진') || 
        category.includes('슬랙스') || 
        category.includes('쇼츠') || 
        category.includes('반바지') || 
        category.includes('스커트')) {
      return 1
    }
    
    // 드레스 (2)
    if (category.includes('원피스') || 
        category.includes('드레스') || 
        category.includes('점프수트') || 
        category.includes('롬퍼')) {
      return 2
    }
    
    return null
  }

  const getCategoryName = (categoryNumber) => {
    switch (categoryNumber) {
      case 0: return '상체'
      case 1: return '하체'
      case 2: return '드레스'
      default: return '미분류'
    }
  }

  const customClothing = [
    {
      id: 7,
      name: "커스텀 셔츠",
      image: "/placeholder.svg?height=200&width=200&text=커스텀+셔츠",
      category: "상의",
    },
    {
      id: 8,
      name: "커스텀 바지",
      image: "/placeholder.svg?height=200&width=200&text=커스텀+바지",
      category: "하의",
    },
    {
      id: 9,
      name: "커스텀 재킷",
      image: "/placeholder.svg?height=200&width=200&text=커스텀+재킷",
      category: "아우터",
    },
  ]

  // 🔥 외부 이미지 감지 함수 추가
  const isExternalImage = (url) => {
    if (!url || url.startsWith('data:') || url.startsWith('/')) return false
    
    try {
      const urlObj = new URL(url)
      const currentHost = window.location.hostname
      
      // localhost:8000은 허용 (백엔드 서버)
      if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
        return false
      }
      
      // 현재 도메인과 다르면 외부 이미지
      return urlObj.hostname !== currentHost
    } catch {
      return false
    }
  }

  // 🔥 CORS 문제 해결을 위한 이미지 변환 함수 수정
  const simpleImageConvert = async (imageUrl, imageName) => {
    console.log(`🔄 이미지 변환 시작: ${imageName}`)
    console.log(`🔍 이미지 URL: ${imageUrl}`)
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // 10초 타임아웃
      const timeout = setTimeout(() => {
        reject(new Error('타임아웃 (10초)'))
      }, 10000)
      
      img.onload = () => {
        clearTimeout(timeout)
        try {
          console.log(`✅ 이미지 로드 성공: ${img.width}x${img.height}`)
          
          // 캔버스 설정
          canvas.width = img.width
          canvas.height = img.height
          
          // 흰색 배경
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0)
          
          // JPEG 변환
          const base64 = canvas.toDataURL('image/jpeg', 0.9)
          console.log(`✅ 이미지 변환 성공: ${imageName}`)
          resolve(base64)
          
        } catch (error) {
          clearTimeout(timeout)
          console.error(`❌ Canvas 변환 실패:`, error)
          
          // CORS 오류인 경우 특별한 안내 메시지
          if (error.message.includes('Tainted canvases') || error.message.includes('tainted')) {
            reject(new Error(`CORS 보안 정책으로 인해 이미지를 변환할 수 없습니다.\n\n해결 방법:\n1. 이미지를 우클릭하여 "다른 이름으로 저장"\n2. 저장된 이미지를 직접 업로드\n\n이미지 출처: ${new URL(imageUrl).hostname}`))
          } else {
            reject(new Error(`Canvas 변환 실패: ${error.message}`))
          }
        }
      }
      
      img.onerror = (error) => {
        clearTimeout(timeout)
        console.error(`❌ 이미지 로드 실패:`, error)
        reject(new Error(`이미지 로드 실패: ${imageUrl}`))
      }
      
      // CORS 설정
      img.crossOrigin = 'anonymous'
      
      // 이미지 로드
      img.src = imageUrl
    })
  }

  // URL 파라미터에서 의류 정보 확인
  useEffect(() => {
    // useParams로 받은 clothingId 처리
    if (clothingId) {
      console.log("URL에서 받은 clothingId:", clothingId)
      // 내 옷장에서 해당 의류 찾기
      loadMyClosetClothes().then(() => {
        // 의류 데이터가 로드된 후 해당 의류 선택
        const targetClothing = myClosetClothes.find(item => item.id.toString() === clothingId)
        if (targetClothing) {
          setSelectedClothingImage(targetClothing.image)
          setSelectedClothingData(targetClothing)
          const categoryNum = mapCategoryToNumber(targetClothing.category)
          setSelectedCategory(categoryNum)
          console.log("의류 자동 선택 완료:", targetClothing)
        }
      })
    }
    
    // URL 쿼리 파라미터 처리 (홈 화면, 의류 페이지에서 전달된 의류 정보)
    const params = new URLSearchParams(location.search)
    const clothingImage = params.get('clothingImage')
    const clothingCategory = params.get('clothingCategory')
    const clothingName = params.get('clothingName')
    const clothingBrand = params.get('clothingBrand')
    const queryClothingId = params.get('clothingId')
    
    if (clothingImage) {
      console.log("URL에서 받은 의류 정보:", {
        image: clothingImage,
        category: clothingCategory,
        name: clothingName,
        brand: clothingBrand,
        id: queryClothingId
      })
      
      // 의류 이미지 설정
      setSelectedClothingImage(decodeURIComponent(clothingImage))
      
      // 의류 데이터 설정
      const clothingData = {
        id: queryClothingId,
        name: decodeURIComponent(clothingName || ''),
        image: decodeURIComponent(clothingImage),
        category: decodeURIComponent(clothingCategory || ''),
        brand: decodeURIComponent(clothingBrand || '')
      }
      setSelectedClothingData(clothingData)
      
      // 카테고리 자동 설정
      if (clothingCategory) {
        const categoryNum = mapCategoryToNumber(decodeURIComponent(clothingCategory))
        setSelectedCategory(categoryNum)
        console.log("카테고리 자동 설정:", categoryNum, decodeURIComponent(clothingCategory))
      }
      
      console.log("의류 정보 자동 설정 완료:", clothingData)
    }
  }, [clothingId, location.search])

  // 좋아요한 의류 데이터 로드
  const loadLikedClothes = async () => {
    if (!isLoggedIn()) {
      console.log("로그인이 필요합니다.")
      setLikedClothing([])
      return
    }

    setLikedClothingLoading(true)
    try {
      const data = await getMyLikedClothes()

      const formattedData = data.map((item) => ({
        id: item.clothing_id,
        name: item.product_name,
        image: item.product_image_url, // 외부 URL이므로 그대로 사용
        category: item.main_category,
        brand: item.brand_name,
        isExternalImage: true, // 외부 이미지임을 표시
      }))

      console.log("좋아요한 의류 로드 완료:", formattedData)
      setLikedClothing(formattedData)
    } catch (error) {
      console.error("좋아요한 의류 로드 실패:", error)
      setLikedClothing([])
    } finally {
      setLikedClothingLoading(false)
    }
  }

  // 인물 이미지 데이터 로드
  const loadPersonImages = async () => {
    if (!isLoggedIn()) {
      console.log("로그인이 필요합니다.")
      setPersonImages([])
      return
    }

    setPersonImagesLoading(true)
    try {
      const data = await getPersonImages(1, 50)
      console.log("인물 이미지 API 응답:", data)

      const validImages = filterValidPersonImages(data.images || [])

      const formattedData = validImages.map((item) => ({
        id: item.id,
        name: item.description || `인물 이미지 ${item.id}`,
        image: getPersonImageUrl(item.image_url),
        created_at: item.created_at,
        description: item.description,
      }))

      setPersonImages(formattedData)
    } catch (error) {
      console.error("인물 이미지 로드 실패:", error)
      setPersonImages([])
    } finally {
      setPersonImagesLoading(false)
    }
  }

  // 내 옷장 의류 데이터 로드
  const loadMyClosetClothes = async () => {
    if (!isLoggedIn()) {
      console.log("로그인이 필요합니다.")
      setMyClosetClothes([])
      return
    }

    setMyClosetLoading(true)
    try {
      const data = await getUserClothes({ page: 1, perPage: 50 })
      console.log("내 옷장 API 응답:", data)

      const formattedData = data.clothes.map((item) => ({
        id: item.id,
        name: item.name,
        image: getClothingImageUrl(item.image_url),
        category: VALID_CATEGORIES.find(c => c.value === item.category)?.label || item.category,
        brand: item.brand,
        color: item.color,
        season: item.season,
        style: item.style,
      }))

      console.log("내 옷장 로드 완료:", formattedData)
      setMyClosetClothes(formattedData)
    } catch (error) {
      console.error("내 옷장 의류 로드 실패:", error)
      setMyClosetClothes([])
    } finally {
      setMyClosetLoading(false)
    }
  }



  useEffect(() => {
    loadLikedClothes()
    loadPersonImages()
    loadMyClosetClothes()
  }, [])

  const handlePersonImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedPersonImage(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleClothingImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedClothingImage(e.target.result)
        setSelectedClothingData(null)
        setSelectedCategory(null)
        setShowCategorySelector(true)
      }
      reader.readAsDataURL(file)
    }
  }

  // 🔥 의류 이미지 선택 함수 수정
  const handleClothingSelect = async (clothing) => {
    console.log("의류 이미지 선택:", clothing.image)
    console.log("이미지 타입:", isExternalImage(clothing.image) ? '외부 이미지' : '로컬 이미지')
    
    setIsConverting(true)
    
    try {
      const base64Image = await simpleImageConvert(clothing.image, clothing.name)
      setSelectedClothingImage(base64Image)
      setSelectedClothingData(clothing)
      
      const autoCategory = mapCategoryToNumber(clothing.category)
      if (autoCategory !== null) {
        setSelectedCategory(autoCategory)
        setShowCategorySelector(false)
      } else {
        setSelectedCategory(null)
        setShowCategorySelector(true)
      }
      
      console.log("✅ 의류 이미지 변환 성공")
    } catch (error) {
      console.error("❌ 의류 이미지 변환 실패:", error)
      
      // 🔥 외부 이미지 전용 안내 메시지
      if (isExternalImage(clothing.image) || clothing.isExternalImage) {
        setFailedImageUrl(clothing.image)
        setShowDownloadHelper(true)
        
        alert(`외부 이미지는 브라우저 보안 정책으로 인해 직접 사용할 수 없습니다.\n\n해결 방법:\n1. 우클릭 후 "이미지를 다른 이름으로 저장" 클릭\n2. 다운로드된 이미지를 "의류 이미지" 섹션에서 직접 업로드\n\n이미지 출처: ${new URL(clothing.image).hostname}`)
      } else {
        alert(`이미지 변환에 실패했습니다: ${error.message}`)
      }
    } finally {
      setIsConverting(false)
    }
  }

  // 🔥 인물 이미지 선택 함수도 동일하게 수정
  const handleUserImageSelect = async (userImage) => {
    console.log("인물 이미지 선택:", userImage.image)
    console.log("이미지 타입:", isExternalImage(userImage.image) ? '외부 이미지' : '로컬 이미지')
    
    setIsConverting(true)
    
    try {
      const base64Image = await simpleImageConvert(userImage.image, userImage.name)
      setSelectedPersonImage(base64Image)
      console.log("✅ 인물 이미지 변환 성공")
    } catch (error) {
      console.error("❌ 인물 이미지 변환 실패:", error)
      
      // 🔥 외부 이미지 전용 안내 메시지
      if (isExternalImage(userImage.image)) {
        setFailedImageUrl(userImage.image)
        setShowDownloadHelper(true)
        
        alert(`외부 이미지는 브라우저 보안 정책으로 인해 직접 사용할 수 없습니다.\n\n📍 해결 방법:\n1. 아래 "이미지 다운로드" 버튼 클릭\n2. 다운로드된 이미지를 "인물 이미지" 섹션에서 직접 업로드\n\n🔗 이미지 출처: ${new URL(userImage.image).hostname}`)
      } else {
        alert(`이미지 변환에 실패했습니다: ${error.message}`)
      }
    } finally {
      setIsConverting(false)
    }
  }

  // 🔥 이미지 다운로드 도우미
  const handleDownloadImage = () => {
    const link = document.createElement('a')
    link.href = failedImageUrl
    link.download = 'image.jpg'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setShowDownloadHelper(false)
    setFailedImageUrl("")
  }

  const handleImageError = (e, title) => {
    e.target.style.display = "none"
    const placeholder = e.target.nextElementSibling
    if (placeholder) {
      placeholder.style.display = "flex"
      placeholder.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style="color: var(--text-secondary); opacity: 0.6;">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <span style="font-size: 0.85rem; color: var(--text-secondary); text-align: center;">이미지가 없습니다</span>
        </div>
      `
    }
  }

  const handleVirtualFitting = async () => {
    if (!selectedPersonImage || !selectedClothingImage) {
      alert("인물 이미지와 의류 이미지를 모두 선택해주세요!")
      return
    }

    if (selectedCategory === null) {
      alert("의류 카테고리를 선택해주세요!")
      return
    }

    if (!isLoggedIn()) {
      alert("로그인이 필요합니다!")
      return
    }

    setIsProcessing(true)
    
    try {
      console.log("=== 가상 피팅 시작 ===")
      console.log("카테고리:", selectedCategory, getCategoryName(selectedCategory))

      console.log("인물 이미지 변환 시작...")
      const personImageFile = await urlToFile(selectedPersonImage, 'person-image.jpg')
      console.log("인물 이미지 변환 완료:", personImageFile.size, "bytes")
      
      console.log("의류 이미지 변환 시작...")
      const clothingImageFile = await urlToFile(selectedClothingImage, 'clothing-image.jpg')
      console.log("의류 이미지 변환 완료:", clothingImageFile.size, "bytes")

      console.log("가상 피팅 API 호출 시작...")

      const result = await startVirtualFitting(
        personImageFile,
        clothingImageFile,
        selectedCategory,
        "dc",
        2.0,
        4
      )

      console.log("가상 피팅 결과:", result)
      alert("가상 피팅이 시작되었습니다! 메인 페이지에서 결과를 확인하세요.")
      
      navigate('/virtual-fitting-main')
      
    } catch (error) {
      console.error("가상 피팅 시작 실패:", error)
      alert(`가상 피팅 시작에 실패했습니다: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // 🔥 url 또는 dataURL을 File 객체로 변환 (http(s), blob:, data: 모두 지원)
  const urlToFile = async (url, filename) => {
    try {
      // dataURL (base64)
      if (url.startsWith('data:')) {
        const response = await fetch(url)
        const blob = await response.blob()
        return new File([blob], filename, { type: blob.type || 'image/jpeg' })
      }

      // blob: 또는 http(s): URL
      if (url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
        const response = await fetch(url, { credentials: 'include' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        return new File([blob], filename, { type: blob.type || 'image/jpeg' })
      }

      throw new Error('지원하지 않는 URL 형식')
    } catch (error) {
      throw new Error(`파일 변환 실패: ${error.message}`)
    }
  }

  const togglePersonImageFit = () => {
    setPersonImageFit((prev) => (prev === "contain" ? "cover" : "contain"))
  }

  const toggleClothingImageFit = () => {
    setClothingImageFit((prev) => (prev === "contain" ? "cover" : "contain"))
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "liked":
        if (likedClothingLoading) {
          return (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>좋아요한 의류를 불러오는 중...</p>
            </div>
          )
        }

        if (!isLoggedIn()) {
          return (
            <div className={styles.emptyState}>
              <Heart className={styles.emptyIcon} />
              <h3>로그인이 필요합니다</h3>
              <p>좋아요한 의류를 보려면 로그인해주세요.</p>
            </div>
          )
        }

        if (likedClothing.length === 0) {
          return (
            <div className={styles.emptyState}>
              <Heart className={styles.emptyIcon} />
              <h3>좋아요한 의류가 없습니다</h3>
              <p>의류를 좋아요하고 가상 피팅을 시도해보세요!</p>
            </div>
          )
        }

        return (
          <div className={styles.itemsGrid}>
            {likedClothing.map((item) => (
              <div key={item.id} className={styles.gridItem} onClick={() => {
                // URL 파라미터 방식으로 의류 정보 전달 (CORS 오류 방지)
                const params = new URLSearchParams({
                  clothingImage: encodeURIComponent(item.image),
                  clothingCategory: encodeURIComponent(item.category),
                  clothingName: encodeURIComponent(item.name),
                  clothingBrand: encodeURIComponent(item.brand || ''),
                  clothingId: item.id.toString()
                })
                
                // 현재 페이지를 새로고침하여 URL 파라미터 적용
                window.location.href = `/virtual-fitting?${params.toString()}`
              }}>
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  onError={(e) => handleImageError(e, item.name)}
                  style={{ display: "block" }}
                />
                <div className={styles.imagePlaceholder} style={{ display: "none" }}>
                  {item.name}
                </div>
                <div className={styles.itemInfo}>
                  <h4>{item.name}</h4>
                  <div className={styles.itemMeta}>
                    <span className={styles.category}>{item.category}</span>
                    {item.brand && <div className={styles.brand}>{item.brand}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      case "images":
        if (personImagesLoading) {
          return (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>내 이미지를 불러오는 중...</p>
            </div>
          )
        }

        if (!isLoggedIn()) {
          return (
            <div className={styles.emptyState}>
              <ImageIcon className={styles.emptyIcon} />
              <h3>로그인이 필요합니다</h3>
              <p>내 이미지를 보려면 로그인해주세요.</p>
            </div>
          )
        }

        if (personImages.length === 0) {
          return (
            <div className={styles.emptyState}>
              <ImageIcon className={styles.emptyIcon} />
              <h3>업로드된 이미지가 없습니다</h3>
              <p>인물 이미지 관리 페이지에서 이미지를 추가해보세요!</p>
            </div>
          )
        }

        return (
          <div className={styles.itemsGrid}>
            {personImages.map((item) => (
              <div key={item.id} className={styles.personImageGridItem} onClick={() => handleUserImageSelect(item)}>
                <img
                  src={item.image || "/placeholder.svg?height=300&width=200&text=No+Image"}
                  alt={item.name}
                  onError={(e) => handlePersonImageError(e, item.name)}
                  style={{ display: "block" }}
                />
                <div className={styles.personImagePlaceholder} style={{ display: "none" }}>
                  {item.name}
                </div>
                <div className={styles.personImageItemInfo}>
                  <h4>{item.name}</h4>
                  <div className={styles.personImageItemMeta}>
                    <span className={styles.personImageCategory}>
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      case "closet":
        if (myClosetLoading) {
          return (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <p>내 옷장을 불러오는 중...</p>
            </div>
          )
        }

        if (!isLoggedIn()) {
          return (
            <div className={styles.emptyState}>
              <ShirtIcon className={styles.emptyIcon} />
              <h3>로그인이 필요합니다</h3>
              <p>내 옷장을 보려면 로그인해주세요.</p>
            </div>
          )
        }

        if (myClosetClothes.length === 0) {
          return (
            <div className={styles.emptyState}>
              <ShirtIcon className={styles.emptyIcon} />
              <h3>옷장이 비어있습니다</h3>
              <p>내 옷장 페이지에서 의류를 추가해보세요!</p>
            </div>
          )
        }

        return (
          <div className={styles.itemsGrid}>
            {myClosetClothes.map((item) => (
              <div key={item.id} className={styles.gridItem} onClick={() => handleClothingSelect(item)}>
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  onError={(e) => handleClothingImageError(e)}
                  style={{ display: "block" }}
                />
                <div className={styles.imagePlaceholder} style={{ display: "none" }}>
                  {item.name}
                </div>
                <div className={styles.itemInfo}>
                  <h4>{item.name}</h4>
                  <div className={styles.itemMeta}>
                    <span className={styles.category}>{item.category}</span>
                    {item.brand && <div className={styles.brand}>{item.brand}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      case "custom":
        return (
          <div className={styles.itemsGrid}>
            {customClothing.map((item) => (
              <div key={item.id} className={styles.gridItem} onClick={() => handleClothingSelect(item)}>
                <img
                  src={item.image || "/placeholder.svg"}
                  alt={item.name}
                  onError={(e) => handleImageError(e, item.name)}
                  style={{ display: "block" }}
                />
                <div className={styles.imagePlaceholder} style={{ display: "none" }}>
                  {item.name}
                </div>
                <div className={styles.itemInfo}>
                  <h4>{item.name}</h4>
                  <div className={styles.itemMeta}>
                    <span className={styles.category}>{item.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`${styles.virtualFittingPage} ${darkMode ? "dark-mode" : ""}`}>
      <Header />

      <div className={styles.virtualFittingContainer}>
        {/* 간단한 변환 상태 표시 */}
        {isConverting && (
          <div style={{
            background: darkMode ? '#2a2a2a' : '#f0f8ff',
            border: '2px solid #4CAF50',
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0',
            textAlign: 'center',
            fontWeight: 'bold',
            color: darkMode ? '#fff' : '#333'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #4CAF50',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span>이미지 변환 중...</span>
            </div>
          </div>
        )}

        {/* 🔥 다운로드 도우미 */}
        {showDownloadHelper && (
          <div style={{
            background: darkMode ? '#2a2a2a' : '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            padding: '20px',
            margin: '16px 0',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>외부 이미지 보안 제한</h3>
            <p style={{ margin: '0 0 10px 0', color: '#856404' }}>
              <strong>{new URL(failedImageUrl).hostname}</strong> 도메인의 이미지는<br/>
              브라우저 CORS 정책으로 인해 직접 변환할 수 없습니다.
            </p>
            <div style={{ 
              background: darkMode ? '#1a1a1a' : '#f8f9fa', 
              padding: '10px', 
              borderRadius: '5px', 
              margin: '10px 0',
              fontSize: '14px',
              color: '#495057'
            }}>
              <strong>해결 방법:</strong><br/>
              1. 아래 버튼으로 이미지 다운로드<br/>
              2. 상단 "의류 이미지" 또는 "인물 이미지" 섹션에서 직접 업로드
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleDownloadImage}
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 'bold'
                }}
              >
                <Download size={18} />
                이미지 다운로드
              </button>
              <button
                onClick={() => setShowDownloadHelper(false)}
                style={{
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 메인 업로드 섹션 */}
        <div className={styles.mainUploadSection}>
          {/* 왼쪽: 인물 이미지 업로드 */}
          <div className={styles.uploadArea}>
            <h2>
              <User className={styles.inlineIcon} /> 인물 이미지
            </h2>
            <div className={styles.imageUploadBox}>
              {selectedPersonImage ? (
                <div className={styles.uploadedImage}>
                  <img
                    src={selectedPersonImage || "/placeholder.svg"}
                    alt="업로드된 인물 이미지"
                    style={{ objectFit: personImageFit }}
                  />
                  <div className={styles.imageControls}>
                    <button
                      className={`${styles.controlBtn} ${styles.changeImageBtn}`}
                      onClick={() => document.getElementById("person-image-input").click()}
                    >
                      변경
                    </button>
                    <button
                      className={`${styles.controlBtn} ${styles.fitToggleBtn} ${styles[personImageFit]}`}
                      onClick={togglePersonImageFit}
                    >
                      {personImageFit === "contain" ? "맞춤" : "채움"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={styles.uploadPlaceholder}
                  onClick={() => document.getElementById("person-image-input").click()}
                >
                  <Camera className={styles.uploadIconSvg} />
                  <p>인물 사진을 업로드하세요</p>
                  <span>클릭하여 이미지 선택</span>
                </div>
              )}
              <input
                id="person-image-input"
                type="file"
                accept="image/*"
                onChange={handlePersonImageUpload}
                style={{ display: "none" }}
              />
            </div>
          </div>

          {/* 오른쪽: 의류 이미지 업로드 */}
          <div className={styles.uploadArea}>
            <h2>
              <Shirt className={styles.inlineIcon} /> 의류 이미지
            </h2>
            <div className={styles.imageUploadBox}>
              {selectedClothingImage ? (
                <div className={styles.uploadedImage}>
                  <img
                    src={selectedClothingImage || "/placeholder.svg"}
                    alt="업로드된 의류 이미지"
                    style={{ objectFit: clothingImageFit }}
                  />
                  <div className={styles.imageControls}>
                    <button
                      className={`${styles.controlBtn} ${styles.changeImageBtn}`}
                      onClick={() => document.getElementById("clothing-image-input").click()}
                    >
                      변경
                    </button>
                    <button
                      className={`${styles.controlBtn} ${styles.fitToggleBtn} ${styles[clothingImageFit]}`}
                      onClick={toggleClothingImageFit}
                    >
                      {clothingImageFit === "contain" ? "맞춤" : "채움"}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={styles.uploadPlaceholder}
                  onClick={() => document.getElementById("clothing-image-input").click()}
                >
                  <Upload className={styles.uploadIconSvg} />
                  <p>의류 사진을 업로드하세요</p>
                  <span>클릭하여 이미지 선택</span>
                </div>
              )}
              <input
                id="clothing-image-input"
                type="file"
                accept="image/*"
                onChange={handleClothingImageUpload}
                style={{ display: "none" }}
              />
            </div>
            
            {/* 카테고리 정보 표시 */}
            {selectedClothingImage && (
              <div className={styles.categoryInfo}>
                {selectedCategory !== null ? (
                  <div className={styles.categoryDisplay}>
                    <span className={styles.categoryLabel}>카테고리:</span>
                    <span className={styles.categoryValue}>{getCategoryName(selectedCategory)}</span>
                    <button 
                      className={styles.categoryChangeBtn}
                      onClick={() => setShowCategorySelector(true)}
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <div className={styles.categoryWarning}>
                    <span>⚠️ 카테고리를 선택해주세요</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 카테고리 선택 모달 */}
        {showCategorySelector && (
          <div className={styles.categoryModal}>
            <div className={styles.categoryModalContent}>
              <h3>의류 카테고리 선택</h3>
              <p>가상 피팅을 위해 의류 카테고리를 선택해주세요.</p>
              <div className={styles.categoryOptions}>
                <button 
                  className={`${styles.categoryOption} ${selectedCategory === 0 ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedCategory(0)
                    setShowCategorySelector(false)
                  }}
                >
                  <Shirt className={styles.categoryIcon} />
                  <span>상체</span>
                  <small>셔츠, 블라우스, 재킷, 아우터 등</small>
                </button>
                <button 
                  className={`${styles.categoryOption} ${selectedCategory === 1 ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedCategory(1)
                    setShowCategorySelector(false)
                  }}
                >
                  <svg className={styles.categoryIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 2v20l4-4 4 4V2z"/>
                  </svg>
                  <span>하체</span>
                  <small>바지, 스커트, 반바지 등</small>
                </button>
                <button 
                  className={`${styles.categoryOption} ${selectedCategory === 2 ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedCategory(2)
                    setShowCategorySelector(false)
                  }}
                >
                  <svg className={styles.categoryIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7v10c0 5.55 3.84 10 9 11 5.16-1 9-5.45 9-11V7l-10-5z"/>
                  </svg>
                  <span>드레스</span>
                  <small>원피스, 드레스, 점프수트 등</small>
                </button>
              </div>
              <button 
                className={styles.categoryModalClose}
                onClick={() => setShowCategorySelector(false)}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 피팅 버튼 */}
        <div className={styles.fittingButtonSection}>
          <button
            className={styles.fittingBtn}
            onClick={handleVirtualFitting}
            disabled={!selectedPersonImage || !selectedClothingImage || selectedCategory === null || isProcessing || isConverting}
          >
            {isProcessing ? (
              <>
                <div className={styles.processingSpinner}></div>
                가상 피팅 처리 중...
              </>
            ) : isConverting ? (
              <>
                <div className={styles.processingSpinner}></div>
                이미지 변환 중...
              </>
            ) : (
              '가상 피팅 시작하기'
            )}
          </button>
        </div>

        {/* 하단 탭 섹션 */}
        <div className={styles.bottomSection}>
          <div className={styles.tabNavigation}>
            <button
              className={`${styles.tabBtn} ${activeTab === "liked" ? styles.active : ""}`}
              onClick={() => setActiveTab("liked")}
            >
              <Heart className={styles.inlineIcon} /> 좋아요한 의류
              {likedClothingLoading && <span style={{ marginLeft: "0.5rem", color: "var(--accent-color)" }}>...</span>}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "images" ? styles.active : ""}`}
              onClick={() => setActiveTab("images")}
            >
              <ImageIcon className={styles.inlineIcon} /> 내 이미지
              {personImagesLoading && <span style={{ marginLeft: "0.5rem", color: "var(--accent-color)" }}>...</span>}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "closet" ? styles.active : ""}`}
              onClick={() => setActiveTab("closet")}
            >
              <ShirtIcon className={styles.inlineIcon} /> 내 옷장
              {myClosetLoading && <span style={{ marginLeft: "0.5rem", color: "var(--accent-color)" }}>...</span>}
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "custom" ? styles.active : ""}`}
              onClick={() => setActiveTab("custom")}
            >
              <Palette className={styles.inlineIcon} /> 커스터마이징 의류
            </button>

          </div>

          <div className={styles.tabContent}>{renderTabContent()}</div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default VirtualFittingPage
