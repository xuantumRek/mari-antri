package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// ===== MODEL =====

type Queue struct {
	ID        uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string    `json:"name" gorm:"not null"`
	NIK       string    `json:"nik" gorm:"not null"`
	Complaint string    `json:"complaint" gorm:"not null"`
	FileURL   string    `json:"file_url"`
	Status    string    `json:"status" gorm:"default:waiting"`
	CreatedAt time.Time `json:"created_at"`
}

// ===== GLOBALS =====

var db *gorm.DB
var s3Client *s3.Client
var bucketName = os.Getenv("S3_BUCKET")

// ===== INIT DB =====

func initDB() {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:3306)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASS"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_NAME"),
	)
	var err error
	db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	db.AutoMigrate(&Queue{})
	log.Println("Database connected and migrated")
}

// ===== INIT S3 =====

func initS3() {
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("ap-southeast-2"),
	)
	if err != nil {
		log.Fatal("Failed to load AWS config:", err)
	}
	s3Client = s3.NewFromConfig(cfg)
	log.Println("S3 client initialized")
}

// ===== HANDLERS =====

// GET /queues — ambil semua antrian
func getQueues(c *gin.Context) {
	var queues []Queue
	db.Order("created_at desc").Find(&queues)
	c.JSON(http.StatusOK, queues)
}

// POST /queues — daftar antrian baru (dengan upload file)
func createQueue(c *gin.Context) {
	name := c.PostForm("name")
	nik := c.PostForm("nik")
	complaint := c.PostForm("complaint")

	if name == "" || nik == "" || complaint == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, nik, complaint wajib diisi"})
		return
	}

	fileURL := ""
	file, header, err := c.Request.FormFile("file")
	if err == nil {
		defer file.Close()
		key := fmt.Sprintf("uploads/%d-%s", time.Now().UnixNano(), header.Filename)
		uploader := manager.NewUploader(s3Client)
		result, err := uploader.Upload(context.TODO(), &s3.PutObjectInput{
			Bucket: &bucketName,
			Key:    &key,
			Body:   file,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal upload file"})
			return
		}
		fileURL = result.Location
	}

	queue := Queue{
		Name:      name,
		NIK:       nik,
		Complaint: complaint,
		FileURL:   fileURL,
		Status:    "waiting",
	}
	db.Create(&queue)
	c.JSON(http.StatusCreated, queue)
}

// PUT /queues/:id/status — update status antrian (untuk admin)
func updateStatus(c *gin.Context) {
	id := c.Param("id")
	var body struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format salah"})
		return
	}
	var queue Queue
	if err := db.First(&queue, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Antrian tidak ditemukan"})
		return
	}
	db.Model(&queue).Update("status", body.Status)
	c.JSON(http.StatusOK, queue)
}

// ===== MAIN =====

func main() {
	initDB()
	initS3()

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT"},
		AllowHeaders:     []string{"Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/queues", getQueues)
	r.POST("/queues", createQueue)
	r.PUT("/queues/:id/status", updateStatus)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server running on port %s", port)
	r.Run(":" + port)
}