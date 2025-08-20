/**
 * ===================================================================
 * 사용자 의류 관리 API (My Closet)
 * ===================================================================
 */

import axios from "axios"

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000"

// axios 인스턴스 생성
const userClothesAPI = axios.create({
  baseURL: `${API_BASE_URL}/api/user-clothes`,
  withCredentials: true, // 세션 쿠키 전송
  timeout: 30000,
})

// 인증 헤더 생성
const getAuthHeaders = () => {
  return {
    // 세션 기반 인증이므로 특별한 헤더 불필요
  }
}

// API 에러 처리
const handleApiError = (error) => {
  if (error.response?.status === 401 || error.message.includes("401")) {
    alert("로그인이 필요합니다.")
    window.location.href = "/login"
    return new Error("로그인이 필요합니다.")
  }
  return error
}

// 요청 인터셉터
userClothesAPI.interceptors.request.use(
  (config) => {
    console.log(`📤 UserClothes API 요청: ${config.method?.toUpperCase()} ${config.url}`, config.data)
    config.headers = { ...config.headers, ...getAuthHeaders() }
    return config
  },
  (error) => {
    console.error("📤 요청 오류:", error)
    return Promise.reject(error)
  },
)

// 응답 인터셉터
userClothesAPI.interceptors.response.use(
  (response) => {
    console.log(
      `📥 UserClothes API 응답: ${response.config.method?.toUpperCase()} ${response.config.url}`,
      response.data,
    )
    return response
  },
  (error) => {
    console.error("📥 응답 오류:", error)
    return Promise.reject(handleApiError(error))
  },
)

// 의류 업로드
export const uploadClothing = async (clothingData) => {
  try {
    const formData = new FormData()

    // 파일 추가
    formData.append("file", clothingData.file)

    // 의류 정보 추가
    formData.append("name", clothingData.name)
    formData.append("category", clothingData.category)

    if (clothingData.brand) formData.append("brand", clothingData.brand)
    if (clothingData.color) formData.append("color", clothingData.color)
    if (clothingData.season) formData.append("season", clothingData.season)
    if (clothingData.style) formData.append("style", clothingData.style)

    const response = await userClothesAPI.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })

    return {
      success: true,
      clothing: response.data.clothing,
      message: response.data.message,
    }
  } catch (error) {
    console.error("의류 업로드 오류:", error)
    return {
      success: false,
      message: error.response?.data?.detail || error.message || "의류 업로드에 실패했습니다.",
    }
  }
}

// 의류 목록 조회
export const getUserClothes = async (params = {}) => {
  try {
    const { page = 1, perPage = 20, category = null, season = null, search = null } = params

    const queryParams = {
      page: page.toString(),
      per_page: perPage.toString(),
    }

    if (category) queryParams.category = category
    if (season) queryParams.season = season
    if (search) queryParams.search = search

    const response = await userClothesAPI.get("/", { params: queryParams })
    return response.data
  } catch (error) {
    console.error("의류 목록 조회 오류:", error)
    throw error
  }
}

// 의류 통계 조회
export const getUserClothesStats = async () => {
  try {
    const response = await userClothesAPI.get("/stats")
    return response.data
  } catch (error) {
    console.error("의류 통계 조회 오류:", error)
    throw error
  }
}

// 특정 의류 조회
export const getClothing = async (clothingId) => {
  try {
    const response = await userClothesAPI.get(`/${clothingId}`)
    return response.data
  } catch (error) {
    console.error("의류 조회 오류:", error)
    throw error
  }
}

// 의류 정보 수정
export const updateClothing = async (clothingId, updateData) => {
  try {
    const response = await userClothesAPI.put(`/${clothingId}`, updateData)
    return response.data
  } catch (error) {
    console.error("의류 정보 수정 오류:", error)
    throw error
  }
}

// 의류 삭제
export const deleteClothing = async (clothingId) => {
  try {
    const response = await userClothesAPI.delete(`/${clothingId}`)
    return response.data
  } catch (error) {
    console.error("의류 삭제 오류:", error)
    throw error
  }
}

// 의류 일괄 삭제
export const bulkDeleteClothes = async (clothingIds) => {
  try {
    const response = await userClothesAPI.delete("/bulk", {
      data: clothingIds,
    })
    return response.data
  } catch (error) {
    console.error("의류 일괄 삭제 오류:", error)
    throw error
  }
}

// 이미지 URL 생성 헬퍼 함수
export const getClothingImageUrl = (imagePath) => {
  if (!imagePath) return null

  if (imagePath.startsWith("http")) {
    return imagePath
  }

  // CORS 문제 해결을 위해 프록시 엔드포인트 사용
  const cleanPath = imagePath.replace(/^\/+/, "")
  return `${API_BASE_URL}/api/proxy-image/${cleanPath}`
}

// 이미지 로드 에러 처리
export const handleClothingImageError = (event, fallbackText = "IMG") => {
  const img = event.target
  const parent = img.parentElement

  img.style.display = "none"

  if (!parent.querySelector(".image-fallback")) {
    const fallback = document.createElement("div")
    fallback.className = "image-fallback"
    fallback.textContent = fallbackText.charAt(0).toUpperCase()
    fallback.style.cssText = `
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #f0f0f0;
      color: #666;
      font-weight: bold;
      font-size: 1.2em;
    `
    parent.appendChild(fallback)
  }
}

// 이미지 압축 함수
export const compressClothingImage = (file, maxWidth = 1200, maxHeight = 1600, quality = 0.8) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      let { width, height } = img

      if (width > maxWidth) {
        height = (height * maxWidth) / width
        width = maxWidth
      }

      if (height > maxHeight) {
        width = (width * maxHeight) / height
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height

      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        },
        "image/jpeg",
        quality,
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

// 유효한 카테고리 목록
export const VALID_CATEGORIES = [
  { value: "top", label: "상의" },
  { value: "bottom", label: "하의" },
  { value: "outer", label: "아우터" },
  { value: "dress", label: "원피스" },
  { value: "shoes", label: "신발" },
  { value: "accessories", label: "액세서리" },
]

// 유효한 계절 목록
export const VALID_SEASONS = [
  { value: "spring", label: "봄" },
  { value: "summer", label: "여름" },
  { value: "fall", label: "가을" },
  { value: "winter", label: "겨울" },
  { value: "all", label: "사계절" },
]

// 파일 유효성 검사
export const validateClothingFile = (file) => {
  const maxSize = 10 * 1024 * 1024 // 10MB
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

  if (file.size > maxSize) {
    return { valid: false, message: "파일 크기는 10MB 이하여야 합니다." }
  }

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, message: "JPG, PNG, WEBP 파일만 업로드 가능합니다." }
  }

  return { valid: true }
}
