from django.urls import path
from .views import (
    LessonPlanListAPIView, RegisterAPIView, LoginAPIView, 
    DirectoryListCreateAPIView, DirectoryDetailAPIView, 
    LessonPlanUploadAPIView, ApprovalRequestListCreateAPIView, 
    ApprovalRequestDetailAPIView, LessonPlanDetailAPIView, 
    AdminUserListAPIView, AdminAssignPermissionAPIView,
    UserSelfPermissionsAPIView, LessonPlanProposeAPIView,
    LessonPlanRatingAPIView, UserProfileUpdateAPIView
)

urlpatterns = [
    path('lesson-plans/', LessonPlanListAPIView.as_view(), name='lesson-plan-list'),
    path('lesson-plans/<int:pk>/', LessonPlanDetailAPIView.as_view(), name='lesson-plan-detail'),
    path('lesson-plans/<int:pk>/propose/', LessonPlanProposeAPIView.as_view(), name='lesson-plan-propose'),
    path('lesson-plans/<int:pk>/ratings/', LessonPlanRatingAPIView.as_view(), name='lesson-plan-ratings'),
    path('lesson-plans/upload/', LessonPlanUploadAPIView.as_view(), name='lesson-plan-upload'),
    path('directories/', DirectoryListCreateAPIView.as_view(), name='directory-list-create'),
    path('directories/<int:pk>/', DirectoryDetailAPIView.as_view(), name='directory-detail'),
    path('approval-requests/', ApprovalRequestListCreateAPIView.as_view(), name='approval-request-list-create'),
    path('approval-requests/<int:pk>/', ApprovalRequestDetailAPIView.as_view(), name='approval-request-detail'),
    path('register/', RegisterAPIView.as_view(), name='register'),
    path('login/', LoginAPIView.as_view(), name='login'),
    path('admin/users/', AdminUserListAPIView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/permissions/', AdminAssignPermissionAPIView.as_view(), name='admin-assign-permissions'),
    path('users/me/permissions/', UserSelfPermissionsAPIView.as_view(), name='user-self-permissions'),
    path('users/me/profile/', UserProfileUpdateAPIView.as_view(), name='user-profile-update'),
]