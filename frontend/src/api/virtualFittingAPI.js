/**
 * 가상 피팅 API
 */

import axios from "axios"

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000"

// axios 인스턴스 생성
const virtualFittingAPI = axios.create({
  baseURL: `${API_BASE_URL}/api/virtual-fitting-redis`,
  withCredentials: true,
  timeout: 60000, // 가상 피팅은 시간이 오래 걸릴 수 있음
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
virtualFittingAPI.interceptors.request.use(
  (config) => {
    console.log(`📤 VirtualFitting API 요청: ${config.method?.toUpperCase()} ${config.url}`)
    config.headers = { ...config.headers, ...getAuthHeaders() }
    return config
  },
  (error) => {
    console.error("📤 요청 오류:", error)
    return Promise.reject(error)
  },
)

// 응답 인터셉터
virtualFittingAPI.interceptors.response.use(
  (response) => {
    console.log(
      `📥 VirtualFitting API 응답: ${response.config.method?.toUpperCase()} ${response.config.url}`,
      response.data,
    )
    return response
  },
  (error) => {
    console.error("📥 응답 오류:", error)
    return Promise.reject(handleApiError(error))
  },
)

// 가상 피팅 시작
export const startVirtualFitting = async (fittingData) => {
  try {
    const formData = new FormData()
    
    // 파일 추가
    formData.append("person_image", fittingData.personImage)
    formData.append("clothing_image", fittingData.clothingImage)
    formData.append("category", fittingData.category.toString())

    const response = await virtualFittingAPI.post("/start", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })

    return {
      success: true,
      processId: response.data.process_id,
      message: response.data.message,
    }
  } catch (error) {
    console.error("가상 피팅 시작 오류:", error)
    return {
      success: false,
      message: error.response?.data?.detail || error.message || "가상 피팅 시작에 실패했습니다.",
    }
  }
}

// 가상 피팅 상태 확인
export const checkFittingStatus = async (processId) => {
  try {
    const response = await virtualFittingAPI.get(`/status/${processId}`)
    return response.data
  } catch (error) {
    console.error("가상 피팅 상태 확인 오류:", error)
    throw error
  }
}

// 가상 피팅 결과 선택
export const selectFittingResult = async (selectionData) => {
  try {
    const response = await virtualFittingAPI.post("/select-result", {
      process_id: selectionData.processId,
      selected_image_url: selectionData.selectedImageUrl,
    })

    return {
      success: true,
      fittingId: response.data.fitting_id,
      message: response.data.message,
    }
  } catch (error) {
    console.error("가상 피팅 결과 선택 오류:", error)
    return {
      success: false,
      message: error.response?.data?.detail || error.message || "결과 선택에 실패했습니다.",
    }
  }
}

// 사용자의 가상 피팅 기록 조회
export const getUserFittings = async (params = {}) => {
  try {
    const { page = 1, perPage = 20 } = params

    const queryParams = {
      page: page.toString(),
      per_page: perPage.toString(),
    }

    const response = await virtualFittingAPI.get("/history", { params: queryParams })
    return response.data
  } catch (error) {
    console.error("가상 피팅 기록 조회 오류:", error)
    throw error
  }
}

// 가상 피팅 결과 삭제
export const deleteFittingResult = async (fittingId) => {
  try {
    const response = await virtualFittingAPI.delete(`/${fittingId}`)
    return response.data
  } catch (error) {
    console.error("가상 피팅 결과 삭제 오류:", error)
    throw error
  }
}

// 사용자의 현재 처리 중인 피팅 개수 확인
export const getUserProcessingCount = async () => {
  try {
    const response = await virtualFittingAPI.get("/processing-count")
    return response.data.count
  } catch (error) {
    console.error("처리 중인 피팅 개수 확인 오류:", error)
    throw error
  }
}
