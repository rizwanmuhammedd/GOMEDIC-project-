# HealthBridge HMS: Multi-Tenant Healthcare SaaS

HealthBridge HMS is a production-grade, multi-tenant Hospital Management System (HMS) built with a modern **Microservices Architecture**. It is designed to scale and provides a complete suite for hospitals to manage appointments, billing, patient records, and real-time communication.

## 🚀 Key Features
- **Multi-Tenant SaaS:** Built-in support for multiple client organizations (hospitals) using subdomain-based routing and strict data isolation.
- **Microservices Architecture:** 5+ independent services communicating via a central API Gateway.
- **Real-Time Communication:** Integrated live chat and instant notifications for doctors and patients using SignalR.
- **Comprehensive Management:** Modules for Billing, Pharmacy (Inventory), Lab Tests, Bed Assignments, and Appointment Scheduling.
- **Production-Ready DevOps:** Includes full Infrastructure-as-Code (IaC) and automated CI/CD pipelines.

## 🛠️ Tech Stack
- **Backend:** .NET 8/9, EF Core, SQL Server, Ocelot API Gateway, SignalR.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, GSAP (Animations).
- **DevOps:** Docker, Docker Compose, Terraform, GitHub Actions.
- **Cloud:** AWS (EC2, S3, CloudFront).

## 📂 Project Structure
- `HospitalMS.ApiGateway`: Central entry point for all client requests.
- `HospitalMS.AuthService.API`: Handles identity, multi-tenant resolution, and RBAC.
- `HospitalMS.PatientService.API`: Manages patient records, doctors, and appointments.
- `HospitalMS.HospitalOpsService.API`: Core operations including Billing, Lab, and Pharmacy.
- `HospitalMS.NotificationService.API`: SignalR hub for real-time chat and alerts.
- `hospitalms-frontend`: Modern React-based dashboard for all user roles.
- `terraform/`: Infrastructure scripts to provision AWS resources.

## 🐳 Running Locally with Docker
1. Clone the repository.
2. Ensure you have Docker and Docker Compose installed.
3. Run the following command at the root:
   ```bash
   docker-compose up --build
   ```
4. Access the API Gateway at `http://localhost:5000`.

## ☁️ Deployment (AWS)
This repository includes everything needed to deploy to AWS for ultra-low cost (~₹200/month).
1. **Infrastructure:** Use the scripts in `/terraform` to provision an EC2 instance and S3/CloudFront hosting.
2. **CI/CD:** GitHub Actions workflows are included in `.github/workflows` to automatically deploy the frontend and backend on every push to the `main` branch.

## 📄 License
This project is for demonstration and portfolio purposes.

---
*Built with ❤️ to solve real-world healthcare challenges.*
