"use client"

import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import Header from "../../components/Header/Header"
import Footer from "../../components/Footer/Footer"
import ImagePlaceholder from "../../components/ImagePlaceholder/ImagePlaceholder"
import { browseClothingItems, getCategories } from "../../api/clothing_items"
import { toggleClothingLike, getMyLikedClothingIds } from "../../api/likedClothes"
import { isLoggedIn } from "../../api/auth"
import styles from "./ClothingBrowsePage.module.css"
import { Heart, AlertTriangle, Search, Clock } from "lucide-react"

const ClothingBrowsePage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  // 상태 관리
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState({
    main_categories: [],
    sub_categories: [],
    genders: [],
    brands: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [userLoggedIn, setUserLoggedIn] = useState(false)
  const [likedClothingIds, setLikedClothingIds] = useState(new Set())
  const [likingInProgress, setLikingInProgress] = useState(new Set())

  // 필터 상태
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    main_category: searchParams.get("main_category") || "",
    sub_category: searchParams.get("sub_category") || "",
    gender: searchParams.get("gender") || "",
    brand: searchParams.get("brand") || "",
    sort_by: searchParams.get("sort_by") || "likes",
    order: searchParams.get("order") || "desc",
    page: Number.parseInt(searchParams.get("page")) || 1,
    size: 21,
  })

  // 페이지네이션 정보
  const [pagination, setPagination] = useState({
    total: 0,
    total_pages: 0,
    current_page: 1,
  })

  // 사용자가 좋아요한 의류 ID 목록 로드
  const loadLikedClothingIds = useCallback(async () => {
    if (!userLoggedIn) {
      setLikedClothingIds(new Set())
      return
    }

    try {
      const likedIds = await getMyLikedClothingIds()
      setLikedClothingIds(new Set(likedIds))
    } catch (error) {
      console.error("좋아요한 의류 목록 로드 실패:", error)
    }
  }, [userLoggedIn])

  // 카테고리 데이터 로드
  const loadCategories = useCallback(async () => {
    try {
      const data = await getCategories()
      setCategories(data)
    } catch (error) {
      console.error("카테고리 로드 실패:", error)
    }
  }, [])

  // 상품 데이터 로드
  const loadProducts = useCallback(async (filterParams) => {
    console.log("Loading products with filters:", filterParams)
    setLoading(true)
    setError("")

    try {
      const data = await browseClothingItems(filterParams)

      const formattedProducts = data.items.map((item) => ({
        id: item.product_id,
        name: item.product_name,
        image: item.product_image_url,
        brand: item.brand_name,
        likes: item.likes, // 크롤링한 원래 좋아요 수
        gender: item.gender,
        category: item.main_category,
        subCategory: item.sub_category,
        productUrl: item.product_url,
      }))

      setProducts(formattedProducts)
      setPagination({
        total: data.total,
        total_pages: data.total_pages,
        current_page: data.page,
      })
    } catch (error) {
      console.error("상품 로드 실패:", error)
      setError("상품을 불러오는데 실패했습니다.")
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  // URL 파라미터 업데이트
  const updateURLParams = useCallback(
    (newFilters) => {
      const params = new URLSearchParams()

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value && value !== "" && key !== "size") {
          params.set(key, value.toString())
        }
      })

      setSearchParams(params)
    },
    [setSearchParams],
  )

  // 필터 변경 핸들러
  const handleFilterChange = useCallback(
    (key, value) => {
      const newFilters = {
        ...filters,
        [key]: value,
        page: 1, // 필터 변경 시 첫 페이지로
      }

      setFilters(newFilters)
      updateURLParams(newFilters)
    },
    [filters, updateURLParams],
  )

  // 페이지 변경 핸들러
  const handlePageChange = useCallback(
    (page) => {
      const newFilters = { ...filters, page }
      setFilters(newFilters)
      updateURLParams(newFilters)
    },
    [filters, updateURLParams],
  )

  // 검색 핸들러
  const handleSearch = useCallback(
    (e) => {
      e.preventDefault()
      const searchValue = e.target.search.value.trim()
      handleFilterChange("search", searchValue)
    },
    [handleFilterChange],
  )

  // 정렬 변경 핸들러
  const handleSortChange = useCallback(
    (sortBy, order) => {
      const newFilters = {
        ...filters,
        sort_by: sortBy,
        order: order,
        page: 1, // 정렬 변경 시 첫 페이지로
      }

      setFilters(newFilters)
      updateURLParams(newFilters)
    },
    [filters, updateURLParams],
  )

  // 필터 초기화
  const resetFilters = useCallback(() => {
    const resetFilters = {
      search: "",
      main_category: "",
      sub_category: "",
      gender: "",
      brand: "",
      sort_by: "likes",
      order: "desc",
      page: 1,
      size: 21,
    }

    setFilters(resetFilters)
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  // 좋아요 토글 핸들러
  const handleLikeToggle = async (e, productId) => {
    e.stopPropagation()

    if (!userLoggedIn) {
      alert("로그인 후 이용 가능합니다.")
      navigate("/login")
      return
    }

    // 이미 처리 중인 경우 무시
    if (likingInProgress.has(productId)) {
      return
    }

    try {
      // 처리 중 상태 추가
      setLikingInProgress((prev) => new Set([...prev, productId]))

      const result = await toggleClothingLike(productId)

      // 사용자의 좋아요 상태만 업데이트 (좋아요 수는 변경하지 않음)
      setLikedClothingIds((prev) => {
        const newSet = new Set(prev)
        if (result.is_liked) {
          newSet.add(productId)
        } else {
          newSet.delete(productId)
        }
        return newSet
      })

      // 성공 메시지 표시 (선택사항)
      // console.log(result.message)
    } catch (error) {
      console.error("좋아요 처리 실패:", error)
      alert("좋아요 처리 중 오류가 발생했습니다.")
    } finally {
      // 처리 중 상태 제거
      setLikingInProgress((prev) => {
        const newSet = new Set(prev)
        newSet.delete(productId)
        return newSet
      })
    }
  }

  // 컴포넌트 마운트 시 실행
  useEffect(() => {
    const loggedIn = isLoggedIn()
    setUserLoggedIn(loggedIn)
    loadCategories()

    // URL 파라미터가 변경될 때마다 필터 상태 업데이트
    const newFilters = {
      search: searchParams.get("search") || "",
      main_category: searchParams.get("main_category") || "",
      sub_category: searchParams.get("sub_category") || "",
      gender: searchParams.get("gender") || "",
      brand: searchParams.get("brand") || "",
      sort_by: searchParams.get("sort_by") || "likes",
      order: searchParams.get("order") || "desc",
      page: Number.parseInt(searchParams.get("page")) || 1,
      size: 21,
    }
    setFilters(newFilters)
  }, [searchParams, loadCategories])

  // 로그인 상태 변경 시 좋아요 목록 로드
  useEffect(() => {
    loadLikedClothingIds()
  }, [loadLikedClothingIds])

  // 필터 변경 시 상품 로드
  useEffect(() => {
    loadProducts(filters)
  }, [filters, loadProducts])

  // 상품 클릭 핸들러
  const handleProductClick = (product) => {
    // 상품 상세 페이지로 이동 또는 모달 열기
    if (product.productUrl) {
      window.open(product.productUrl, "_blank", "noopener,noreferrer")
    } else {
      console.log("상품 URL이 없습니다:", product)
    }
    // navigate(`/product/${product.id}`)
  }

  // 가상 피팅 핸들러
  const handleTryOn = (e, product) => {
    e.stopPropagation()
    if (!userLoggedIn) {
      alert("로그인 후 이용 가능합니다.")
      navigate("/login")
      return
    }
    console.log("가상 피팅:", product)
    
    // 의류 정보를 URL 파라미터로 전달
    const params = new URLSearchParams({
      clothingImage: encodeURIComponent(product.image),
      clothingCategory: encodeURIComponent(product.category),
      clothingName: encodeURIComponent(product.name),
      clothingBrand: encodeURIComponent(product.brand || ''),
      clothingId: product.id.toString()
    })
    
    navigate(`/virtual-fitting?${params.toString()}`)
  }

  return (
    <div className={styles.clothingBrowsePage}>
      <Header />

      <main className={styles.browseMain}>
        <div className={styles.container}>
          {/* 페이지 헤더 */}
          <div className={styles.pageHeader}>
            <h1>의류 둘러보기</h1>
            <p>다양한 브랜드의 최신 패션 아이템을 만나보세요</p>
          </div>

          <div className={styles.browseLayout}>
            {/* 사이드바 필터 */}
            <aside className={styles.filterSidebar}>
              <div className={styles.filterHeader}>
                <h3>필터</h3>
                <button className={styles.resetButton} onClick={resetFilters}>
                  초기화
                </button>
              </div>

              {/* 검색 */}
              <div className={styles.filterSection}>
                <h4>검색</h4>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                  <input
                    type="text"
                    name="search"
                    placeholder="상품명, 브랜드 검색..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    className={styles.searchInput}
                  />
                  <button type="submit" className={styles.searchButton}>
                    <Search size={16} />
                  </button>
                </form>
              </div>

              {/* 정렬 */}
              <div className={styles.filterSection}>
                <h4>정렬</h4>
                <div className={styles.sortOptions}>
                  <label className={styles.sortOption}>
                    <input
                      type="radio"
                      name="sort"
                      value="likes-desc"
                      checked={filters.sort_by === "likes" && filters.order === "desc"}
                      onChange={() => handleSortChange("likes", "desc")}
                    />
                    인기순
                  </label>
                  <label className={styles.sortOption}>
                    <input
                      type="radio"
                      name="sort"
                      value="latest-desc"
                      checked={filters.sort_by === "latest" && filters.order === "desc"}
                      onChange={() => handleSortChange("latest", "desc")}
                    />
                    최신순
                  </label>
                  <label className={styles.sortOption}>
                    <input
                      type="radio"
                      name="sort"
                      value="name-asc"
                      checked={filters.sort_by === "name" && filters.order === "asc"}
                      onChange={() => handleSortChange("name", "asc")}
                    />
                    이름순
                  </label>
                </div>
              </div>

              {/* 성별 필터 */}
              <div className={styles.filterSection}>
                <h4>성별</h4>
                <div className={styles.filterOptions}>
                  <label className={styles.filterOption}>
                    <input
                      type="radio"
                      name="gender"
                      value=""
                      checked={filters.gender === ""}
                      onChange={() => handleFilterChange("gender", "")}
                    />
                    전체
                  </label>
                  {categories.genders.map((gender) => (
                    <label key={gender} className={styles.filterOption}>
                      <input
                        type="radio"
                        name="gender"
                        value={gender}
                        checked={filters.gender === gender}
                        onChange={() => handleFilterChange("gender", gender)}
                      />
                      {gender}
                    </label>
                  ))}
                </div>
              </div>

              {/* 메인 카테고리 필터 */}
              <div className={styles.filterSection}>
                <h4>메인 카테고리</h4>
                <select
                  value={filters.main_category}
                  onChange={(e) => handleFilterChange("main_category", e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">전체</option>
                  {categories.main_categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* 서브 카테고리 필터 */}
              <div className={styles.filterSection}>
                <h4>서브 카테고리</h4>
                <select
                  value={filters.sub_category}
                  onChange={(e) => handleFilterChange("sub_category", e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">전체</option>
                  {categories.sub_categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              {/* 브랜드 필터 */}
              <div className={styles.filterSection}>
                <h4>브랜드</h4>
                <select
                  value={filters.brand}
                  onChange={(e) => handleFilterChange("brand", e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">전체</option>
                  {categories.brands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
            </aside>

            {/* 메인 콘텐츠 */}
            <div className={styles.browseContent}>
              {/* 결과 헤더 */}
              <div className={styles.resultsHeader}>
                <div className={styles.resultsInfo}>
                  {loading ? (
                    <span>로딩 중...</span>
                  ) : (
                    <span>
                      총 {pagination.total.toLocaleString()}개의 상품
                      {filters.search && ` (검색: "${filters.search}")`}
                    </span>
                  )}
                </div>
              </div>

              {/* 상품 그리드 */}
              {loading ? (
                <div className={styles.loadingContainer}>
                  <div className={styles.loadingSpinner}></div>
                  <p>상품을 불러오는 중...</p>
                </div>
              ) : error ? (
                <div className={styles.errorContainer}>
                  <div className={styles.errorIcon}>
                    <AlertTriangle size={48} />
                  </div>
                  <p>{error}</p>
                  <button className={styles.retryButton} onClick={() => loadProducts(filters)}>
                    다시 시도
                  </button>
                </div>
              ) : products.length === 0 ? (
                <div className={styles.emptyContainer}>
                  <div className={styles.emptyIcon}>🔍</div>
                  <h3>검색 결과가 없습니다</h3>
                  <p>다른 검색어나 필터를 시도해보세요</p>
                  <button className={styles.resetButton} onClick={resetFilters}>
                    필터 초기화
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.productGrid}>
                    {products.map((product) => (
                      <div key={product.id} className={styles.productCard} onClick={() => handleProductClick(product)}>
                        <div className={styles.productImage}>
                          {product.image ? (
                            <img
                              src={product.image || "/placeholder.svg"}
                              alt={product.name}
                              className={styles.productImg}
                              onError={(e) => {
                                e.target.style.display = "none"
                                e.target.nextSibling.style.display = "flex"
                              }}
                            />
                          ) : null}
                          <div style={{ display: product.image ? "none" : "flex" }} className={styles.imagePlaceholder}>
                            <ImagePlaceholder productName={product.name} />
                          </div>

                          <div className={styles.productOverlay}>
                            <button className={styles.tryOnButton} onClick={(e) => handleTryOn(e, product)}>가상 피팅</button>
                            <button
                              className={`${styles.likeButton} ${likedClothingIds.has(product.id) ? styles.liked : ""}`}
                              onClick={(e) => handleLikeToggle(e, product.id)}
                              disabled={likingInProgress.has(product.id)}
                            >
                              <span className={styles.heartIcon}>
                                {likingInProgress.has(product.id) ? (
                                  <Clock size={16} />
                                ) : likedClothingIds.has(product.id) ? (
                                  <Heart size={16} fill="currentColor" />
                                ) : (
                                  <Heart size={16} />
                                )}
                              </span>
                            </button>
                          </div>

                          <div className={styles.productBadge}>{product.category}</div>
                        </div>

                        <div className={styles.productInfo}>
                          <div className={styles.productBrand}>{product.brand}</div>
                          <h3 className={styles.productName}>{product.name}</h3>
                          <div className={styles.productMeta}>
                            <span className={styles.likesCount}>
                              <Heart size={14} className={styles.likesIcon} />
                              {product.likes.toLocaleString()} {/* 크롤링한 원래 좋아요 수 유지 */}
                            </span>
                            <span className={styles.genderTag}>{product.gender}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 페이지네이션 */}
                  {pagination.total_pages > 1 && (
                    <div className={styles.pagination}>
                      <button
                        className={styles.paginationButton}
                        disabled={pagination.current_page === 1}
                        onClick={() => handlePageChange(pagination.current_page - 1)}
                      >
                        이전
                      </button>

                      <div className={styles.paginationNumbers}>
                        {Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                          const startPage = Math.max(1, pagination.current_page - 2)
                          const pageNumber = startPage + i

                          if (pageNumber > pagination.total_pages) return null

                          return (
                            <button
                              key={pageNumber}
                              className={`${styles.paginationNumber} ${pageNumber === pagination.current_page ? styles.active : ""}`}
                              onClick={() => handlePageChange(pageNumber)}
                            >
                              {pageNumber}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        className={styles.paginationButton}
                        disabled={pagination.current_page === pagination.total_pages}
                        onClick={() => handlePageChange(pagination.current_page + 1)}
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ClothingBrowsePage
