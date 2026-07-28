"""
数据模型定义
使用 Pydantic 定义所有表的 Request/Response schemas
"""

from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator
from typing import Optional, List, Literal
from datetime import datetime, date
from uuid import UUID


# ============================================================================
# 通用模型
# ============================================================================

class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    detail: Optional[str] = None


# ============================================================================
# 认证相关模型
# ============================================================================

class LoginRequest(BaseModel):
    """登录请求"""
    email: EmailStr
    password: Optional[str] = None  # OTP 模式下可以为空


class PasswordLoginRequest(BaseModel):
    """密码登录请求"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="密码至少6位")
    remember_me: Optional[bool] = False  # 记住登录状态（30天免登录）


class ChangePasswordRequest(BaseModel):
    """Change password request."""
    current_password: str = Field(..., min_length=6)
    new_password: str = Field(..., min_length=8)


class RegisterRequest(BaseModel):
    """注册请求"""
    email: EmailStr
    password: str = Field(..., min_length=6, description="密码至少6位")
    name: Optional[str] = None  # 可选的用户名


class OTPRequest(BaseModel):
    """OTP 请求"""
    email: EmailStr


class OTPVerifyRequest(BaseModel):
    """OTP 验证请求"""
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)


class TokenResponse(BaseModel):
    """Token 响应"""
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    role: str = "user"
    must_change_password: bool = False


class UserResponse(BaseModel):
    """用户响应模型"""
    id: UUID
    email: EmailStr
    name: str
    role: str = "user"  # 'admin' 或 'user'
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Departments (部门)
# ============================================================================

class DepartmentBase(BaseModel):
    """部门基础模型"""
    name: str
    code: Optional[str] = None
    description: Optional[str] = None


class DepartmentCreate(DepartmentBase):
    """创建部门"""
    pass


class DepartmentUpdate(BaseModel):
    """更新部门"""
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None


class Department(DepartmentBase):
    """部门响应模型"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Factories (工厂)
# ============================================================================

class FactoryBase(BaseModel):
    """工厂基础模型"""
    code: str
    name: str
    region: Optional[str] = None
    is_active: bool = True


class FactoryCreate(FactoryBase):
    pass


class FactoryUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None


class Factory(FactoryBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# Alias for backward compatibility
FactoryResponse = Factory


# ============================================================================
# Task Types (任务类型)
# ============================================================================

class TaskTypeBase(BaseModel):
    """任务类型基础模型"""
    code: str
    name: str
    color_hex: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class TaskTypeCreate(TaskTypeBase):
    pass


class TaskTypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class TaskType(TaskTypeBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    sort_order: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


# Alias for backward compatibility
TaskTypeResponse = TaskType


# ============================================================================
# Resource Task Types (资源任务类型)
# ============================================================================

class ResourceTaskTypeBase(BaseModel):
    """资源任务类型基础模型"""
    code: str
    name: str
    color_hex: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class ResourceTaskTypeCreate(ResourceTaskTypeBase):
    pass


class ResourceTaskTypeUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    color_hex: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ResourceTaskType(ResourceTaskTypeBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Skills (技能)
# ============================================================================

class SkillBase(BaseModel):
    """技能基础模型"""
    module_id: int
    module_name: str
    skill_name: str
    skill_code: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: bool = True


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    module_id: Optional[int] = None
    module_name: Optional[str] = None
    skill_name: Optional[str] = None
    skill_code: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class Skill(SkillBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# Alias for backward compatibility
SkillResponse = Skill


# ============================================================================
# Competency Definitions (能力定义)
# ============================================================================

class CompetencyDefinitionBase(BaseModel):
    """能力定义基础模型"""
    module_id: int
    module_name: str
    competency_type: str
    competency_code: Optional[str] = None
    competency_name: str
    level_1_description: Optional[str] = None
    level_2_description: Optional[str] = None
    level_3_description: Optional[str] = None
    is_active: bool = True


class CompetencyDefinitionCreate(CompetencyDefinitionBase):
    pass


class CompetencyDefinitionUpdate(BaseModel):
    module_id: Optional[int] = None
    module_name: Optional[str] = None
    competency_type: Optional[str] = None
    competency_code: Optional[str] = None
    competency_name: Optional[str] = None
    level_1_description: Optional[str] = None
    level_2_description: Optional[str] = None
    level_3_description: Optional[str] = None
    is_active: Optional[bool] = None


class CompetencyDefinition(CompetencyDefinitionBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Employees (员工)
# ============================================================================

class EmployeeBase(BaseModel):
    """员工基础模型"""
    employee_id: str
    name: str
    email: Optional[EmailStr] = None  # 允许为空
    department_id: Optional[int] = None
    position: Optional[str] = None
    role: Optional[str] = None
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    employee_id: Optional[str] = None
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    department_id: Optional[int] = None
    position: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class Employee(EmployeeBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    department_name: Optional[str] = None  # 部门名称，用于展示
    
    model_config = ConfigDict(from_attributes=True)


# Alias for backward compatibility
EmployeeResponse = Employee


# ============================================================================
# Competency Assessments (能力评估)
# ============================================================================

class CompetencyAssessmentBase(BaseModel):
    """能力评估基础模型"""
    employee_id: UUID
    skill_id: int
    current_level: int = Field(..., ge=0, le=4)
    target_level: int = Field(..., ge=0, le=4)
    assessment_date: Optional[datetime] = None
    assessor_notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_target(self):
        if self.target_level < self.current_level:
            raise ValueError("目标能力必须大于或等于能力现状")
        return self


class CompetencyAssessmentCreate(CompetencyAssessmentBase):
    pass


class CompetencyAssessmentUpdate(BaseModel):
    current_level: Optional[int] = Field(None, ge=0, le=4)
    target_level: Optional[int] = Field(None, ge=0, le=4)
    assessment_date: Optional[datetime] = None
    assessor_notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_submitted_pair(self):
        if (
            self.current_level is not None
            and self.target_level is not None
            and self.target_level < self.current_level
        ):
            raise ValueError("目标能力必须大于或等于能力现状")
        return self


class CompetencyAssessment(CompetencyAssessmentBase):
    id: UUID
    gap: Optional[int] = None  # 计算列
    last_assessment_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)


class CompetencyAssessmentSave(BaseModel):
    """Payload for an authorized matrix save."""

    current_level: int = Field(..., ge=0, le=4)
    target_level: int = Field(..., ge=0, le=4)
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_target(self):
        if self.target_level < self.current_level:
            raise ValueError("目标能力必须大于或等于能力现状")
        return self


class CompetencyAssessmentHistoryResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    employee_id: UUID
    skill_id: int
    current_level: int
    target_level: int
    gap: int
    assessment_year: int
    assessment_quarter: int
    notes: Optional[str] = None
    changed_at: datetime
    changed_by_user_id: Optional[UUID] = None
    change_source: str

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Tasks (任务)
# ============================================================================

class TaskBase(BaseModel):
    """任务基础模型"""
    task_name: str
    task_type: str
    task_location: str
    assigned_employee_id: Optional[UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    hours_per_day: Optional[float] = None
    total_hours: Optional[float] = None
    status: str = "active"
    required_skills: Optional[List[int]] = None
    notes: Optional[str] = None
    time_slot: Optional[str] = None
    competence: Optional[str] = None
    # 审批工作流字段
    rejection_reason: Optional[str] = None
    requester_id: Optional[UUID] = None
    rejected_by: Optional[str] = None  # 'admin' | 'employee'


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    task_type: Optional[str] = None
    task_location: Optional[str] = None
    assigned_employee_id: Optional[UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    hours_per_day: Optional[float] = None
    total_hours: Optional[float] = None
    status: Optional[str] = None
    required_skills: Optional[List[int]] = None
    notes: Optional[str] = None
    time_slot: Optional[str] = None
    competence: Optional[str] = None
    rejection_reason: Optional[str] = None
    requester_id: Optional[UUID] = None
    rejected_by: Optional[str] = None


class TaskExecutionStatusUpdate(BaseModel):
    status: Literal["confirmed", "in_progress", "completed"]

    model_config = ConfigDict(extra="forbid")


class Task(TaskBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Notifications (通知)
# ============================================================================

class Notification(BaseModel):
    """通知模型"""
    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str
    task_id: Optional[UUID] = None
    is_read: bool = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    """通知列表响应"""
    notifications: List[Notification]
    unread_count: int


# ============================================================================
# Resource Planning Tasks (资源规划任务)
# ============================================================================

class ResourcePlanningTaskBase(BaseModel):
    """资源规划任务基础模型"""
    employee_id: UUID
    task_type_code: str
    start_week: str
    end_week: str
    factory_code: str
    hours: float
    is_cross_factory: bool = False
    notes: Optional[str] = None


class ResourcePlanningTaskCreate(ResourcePlanningTaskBase):
    pass


class ResourcePlanningTaskUpdate(BaseModel):
    employee_id: Optional[UUID] = None
    task_type_code: Optional[str] = None
    start_week: Optional[str] = None
    end_week: Optional[str] = None
    factory_code: Optional[str] = None
    hours: Optional[float] = None
    is_cross_factory: Optional[bool] = None
    notes: Optional[str] = None


class ResourcePlanningTask(ResourcePlanningTaskBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    year: Optional[int] = None
    week_number: Optional[int] = None
    employee_name: Optional[str] = None
    department_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Schedule Change Notifications (计划变更通知)
# ============================================================================

class ScheduleChangeNotificationBase(BaseModel):
    """计划变更通知基础模型"""
    task_id: UUID
    affected_employee_id: UUID
    modified_by_employee_id: UUID
    notification_type: str
    change_description: Optional[str] = None
    is_read: bool = False


class ScheduleChangeNotificationCreate(ScheduleChangeNotificationBase):
    pass


class ScheduleChangeNotificationUpdate(BaseModel):
    is_read: Optional[bool] = None


class ScheduleChangeNotification(ScheduleChangeNotificationBase):
    id: UUID
    notification_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
