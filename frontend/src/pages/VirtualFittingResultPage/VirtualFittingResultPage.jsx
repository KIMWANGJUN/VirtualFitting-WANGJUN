"use client"

import { useEffect, useState, useContext } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ThemeContext } from "../../context/ThemeContext"
import Header from "../../components/Header/Header"
import Footer from "../../components/Footer/Footer"
import { 
  getFittingStatus, 
  getProcessInputUrl, 
  selectFittingResult, 
  getResultInputUrl, 
  getFittingResultImageUrl, 
  respinSavedFitting,
  getSavedFittingsList,
  getSavedFittingOriginalOptions,
  reselectFittingOption
} from "../../api/virtual_fitting"

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 2fr',
  gap: '24px',
  padding: '24px',
}

const panelStyle = {
  background: '#111827',
  borderRadius: '12px',
  padding: '16px',
}

const imageStyle = {
  width: '100%',
  height: 'auto',
  borderRadius: '8px',
}

const savedListStyle = {
  background: '#1f2937',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
}

const savedItemStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  margin: '4px',
  padding: '8px 12px',
  background: '#374151',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '14px',
  gap: '8px',
}

const selectedItemStyle = {
  ...savedItemStyle,
  background: '#3b82f6',
  color: 'white',
}

const thumbnailStyle = {
  width: '24px',
  height: '24px',
  borderRadius: '4px',
  objectFit: 'cover',
}

export default function VirtualFittingResultPage() {
  const { darkMode } = useContext(ThemeContext)
  const params = useParams()
  const processId = params.processId
  const fittingId = params.fittingId
  const navigate = useNavigate()

  const [status, setStatus] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [modelPreview, setModelPreview] = useState(null)
  const [clothPreview, setClothPreview] = useState(null)
  const [savedImageUrl, setSavedImageUrl] = useState(null)
  
  // 새로운 상태들
  const [savedFittingsList, setSavedFittingsList] = useState([])
  const [originalOptions, setOriginalOptions] = useState([])
  const [selectedFittingId, setSelectedFittingId] = useState(fittingId)
  const [isRespinning, setIsRespinning] = useState(false)

  const isSavedMode = !!fittingId

  // 다크모드에 따른 스타일 동적 적용
  const getTextColor = () => darkMode ? 'white' : 'black'
  const getButtonIconColor = () => darkMode ? 'black' : 'black'

  useEffect(() => {
    let timer
    const load = async () => {
      try {
        setLoading(true)
        if (processId) {
          // 프로세스 모드
          const data = await getFittingStatus(processId)
          setStatus(data)
          if (Array.isArray(data.result_images)) {
            // 백엔드에서 반환한 URL을 그대로 사용 (캐시 무효화를 위해 타임스탬프 추가)
            const imageUrls = data.result_images.map(url => 
              `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${url}?t=${Date.now()}`
            )
            setImages(imageUrls)
          }
          setModelPreview(getProcessInputUrl(processId, 'model'))
          setClothPreview(getProcessInputUrl(processId, 'cloth'))
        } else if (fittingId) {
          // 저장 결과 모드
          setSavedImageUrl(getFittingResultImageUrl(fittingId))
          setModelPreview(getResultInputUrl(fittingId, 'model'))
          setClothPreview(getResultInputUrl(fittingId, 'cloth'))
          
          // 원본 선택지들 로드
          try {
            const optionsData = await getSavedFittingOriginalOptions(fittingId)
            console.log("원본 선택지 API 응답:", JSON.stringify(optionsData, null, 2))
            console.log("original_options 배열:", optionsData.original_options)
            console.log("original_options 길이:", optionsData.original_options?.length)
            // 백엔드에서 받은 URL이 상대 경로일 수 있으므로 전체 URL로 변환
            const fullUrls = (optionsData.original_options || []).map((url, index) => {
              if (url.startsWith('http')) {
                return url // 이미 전체 URL인 경우
              } else {
                // 상대 경로인 경우 전체 URL로 변환
                return `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}${url}`
              }
            })
            setOriginalOptions(fullUrls)
          } catch (e) {
            console.warn("원본 선택지 로드 실패:", e)
            setOriginalOptions([])
          }
        }
      } catch (e) {
        setError(e.message || '상태 조회 실패')
      } finally {
        setLoading(false)
      }
    }
    load()
    
    // 저장 모드에서만 저장된 목록 로드
    if (fittingId) {
      loadSavedFittingsList()
    }
    
    // 폴링 제거 - 결과 선택 화면에서는 자동 새로고침 없음
    // if (processId) {
    //   timer = setInterval(load, 5000)
    // }
    // return () => clearInterval(timer)
  }, [processId, fittingId])

  const loadSavedFittingsList = async () => {
    try {
      const data = await getSavedFittingsList()
      setSavedFittingsList(data.fittings || [])
    } catch (e) {
      console.warn("저장된 목록 로드 실패:", e)
    }
  }

  const handleSelect = async (index) => {
    try {
      await selectFittingResult(processId, index + 1)
      alert('결과가 저장되었습니다.')
      window.close()
      navigate('/virtual-fitting-main')
    } catch (e) {
      alert(e.message || '선택 실패')
    }
  }

  const handleSavedFittingSelect = async (newFittingId) => {
    setSelectedFittingId(newFittingId)
    setSavedImageUrl(getFittingResultImageUrl(newFittingId))
    setModelPreview(getResultInputUrl(newFittingId, 'model'))
    setClothPreview(getResultInputUrl(newFittingId, 'cloth'))
    
    // 원본 선택지들 로드
    try {
      const optionsData = await getSavedFittingOriginalOptions(newFittingId)
      setOriginalOptions(optionsData.original_options || [])
    } catch (e) {
      console.warn("원본 선택지 로드 실패:", e)
      setOriginalOptions([])
    }
  }

  const handleRespin = async () => {
    if (!window.confirm('이 결과를 기반으로 새로운 가상 피팅을 시작할까요?')) return
    setIsRespinning(true)
    try {
      const res = await respinSavedFitting(selectedFittingId)
      alert('새로운 가상 피팅이 큐에 추가되었습니다! 메인 페이지로 이동합니다.')
      window.close()
      navigate('/virtual-fitting-main')
    } catch (e) {
      alert(e.message || '재생성 실패')
    } finally {
      setIsRespinning(false)
    }
  }

  const handleOriginalOptionSelect = async (optionIndex) => {
    if (!window.confirm(`이 선택지(${optionIndex + 1}번)로 결과를 변경하시겠습니까?`)) return
    
    try {
      const result = await reselectFittingOption(selectedFittingId, optionIndex)
      alert(result.message)
      
      // 결과 이미지 새로고침
      setSavedImageUrl(getFittingResultImageUrl(selectedFittingId) + '?t=' + Date.now())
      
      // 상단 목록의 썸네일도 새로고침
      await loadSavedFittingsList()
    } catch (e) {
      alert(e.message || '재선택 실패')
    }
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <Header />
      <div style={{ padding: '16px' }}>
        <h2 style={{ color: getTextColor() }}>가상 피팅 결과 {isSavedMode ? '미리보기' : '선택'}</h2>
        
        {isSavedMode && (
          <div style={savedListStyle}>
            <h3 style={{ color: getTextColor() }}>저장된 가상 피팅 모델들</h3>
            <div>
              {savedFittingsList.map((fitting) => (
                <span
                  key={fitting.fitting_id}
                  style={fitting.fitting_id === selectedFittingId ? selectedItemStyle : savedItemStyle}
                  onClick={() => handleSavedFittingSelect(fitting.fitting_id)}
                >
                  <img 
                    src={fitting.image_url} 
                    alt="썸네일" 
                    style={thumbnailStyle}
                    onError={(e) => {
                      e.target.src = '/placeholder.svg?height=24&width=24'
                    }}
                  />
                  {new Date(fitting.created_at).toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric'
                  })}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && <p style={{ color: getTextColor() }}>불러오는 중...</p>}
        {error && <p style={{ color: 'tomato' }}>{error}</p>}

        <div style={gridStyle}>
          {/* 좌측: 입력 이미지 패널 */}
          <div style={panelStyle}>
            <h3 style={{ color: getTextColor() }}>입력 이미지</h3>
            <div style={{ marginBottom: '16px' }}>
              <img src={modelPreview || '/placeholder.svg'} alt="인물 이미지" style={imageStyle} />
              <span style={{ color: getTextColor() }}>인물</span>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <img src={clothPreview || '/placeholder.svg'} alt="의류 이미지" style={imageStyle} />
              <span style={{ color: getTextColor() }}>의류</span>
            </div>
            {isSavedMode && savedImageUrl && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ color: getTextColor() }}>저장된 결과</h4>
                <img src={savedImageUrl} alt="저장된 결과" style={imageStyle} />
              </div>
            )}
          </div>

          {/* 우측: 결과 패널 */}
          <div style={panelStyle}>
            <h3 style={{ color: getTextColor() }}>{isSavedMode ? '재선택 및 재생성' : '결과 선택'}</h3>
            
            {isSavedMode ? (
              <div>
                {/* 원본 4가지 선택지 표시 */}
                {originalOptions.length > 0 ? (
                  <div>
                    <h4 style={{ color: getTextColor() }}>이전에 생성된 4가지 합성 이미지들</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                      {originalOptions.map((url, idx) => (
                        <div key={idx} style={{ textAlign: 'center' }}>
                          <img src={url} alt={`원본 선택지 ${idx + 1}`} style={imageStyle} />
                          <button 
                            style={{ 
                              marginTop: '8px', 
                              width: '100%', 
                              padding: '8px',
                              color: getTextColor()
                            }}
                            onClick={() => handleOriginalOptionSelect(idx)}
                          >
                            이 선택지로 변경
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ marginBottom: '16px', opacity: 0.7, color: getTextColor() }}>
                    원본 선택지들을 찾을 수 없습니다. (이전 버전에서 생성된 결과일 수 있습니다)
                  </p>
                )}
                
                {/* 재생성 버튼 */}
                <div style={{ borderTop: '1px solid #374151', paddingTop: '16px' }}>
                  <h4 style={{ color: getTextColor() }}>새로운 가상 피팅 생성</h4>
                  <p style={{ marginBottom: '16px', opacity: 0.7, color: getTextColor() }}>
                    현재 입력 이미지들로 새로운 가상 피팅을 시작하여 4가지 새로운 선택지를 생성합니다.
                  </p>
                  <button
                    onClick={handleRespin}
                    disabled={isRespinning}
                    style={{
                      padding: '12px 24px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isRespinning ? 'not-allowed' : 'pointer',
                      opacity: isRespinning ? 0.6 : 1
                    }}
                  >
                    {isRespinning ? '재생성 중...' : '재생성하여 다시 선택하기'}
                  </button>
                </div>
              </div>
            ) : (
              // 프로세스 모드: 기존 선택지 표시
              images.length === 0 ? (
                <p style={{ color: getTextColor() }}>결과 이미지가 아직 준비되지 않았습니다. 잠시 후 새로고침 됩니다.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {images.map((url, idx) => (
                    <div key={idx} style={{ textAlign: 'center' }}>
                      <img src={url} alt={`result-${idx + 1}`} style={imageStyle} />
                      <button 
                        style={{ 
                          marginTop: '8px', 
                          width: '100%', 
                          padding: '8px',
                          color: getTextColor()
                        }}
                        onClick={() => handleSelect(idx)}
                      >
                        선택
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}


