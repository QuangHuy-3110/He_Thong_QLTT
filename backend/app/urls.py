from django.urls import path
from .views import (
    LessonPlanListAPIView, RegisterAPIView, LoginAPIView, KeycloakMockLoginAPIView, KeycloakLoginAPIView,
    DirectoryListCreateAPIView, DirectoryDetailAPIView, 
    LessonPlanUploadAPIView, ApprovalRequestListCreateAPIView, 
    ApprovalRequestDetailAPIView, LessonPlanDetailAPIView, 
    AdminUserListAPIView, AdminAssignPermissionAPIView, AdminUserDetailAPIView,
    UserSelfPermissionsAPIView, LessonPlanProposeAPIView,
    LessonPlanRatingAPIView, UserProfileUpdateAPIView,
    LessonPlanWithdrawAPIView, LessonPlanParseDocxAPIView,
    LessonPlanCheckDuplicateAPIView,
    AIChatSessionListCreateAPIView, AIChatSessionDetailAPIView,
    AIChatSendMessageAPIView, AIChatGraphDataAPIView,
    SystemSettingAPIView, BackgroundTasksStatusAPIView, ObsidianStatusAPIView,
    BackgroundTasksReprocessAPIView, ObsidianNotesListAPIView, ObsidianNoteContentAPIView
)

urlpatterns = [
    path('lesson-plans/parse-docx/', LessonPlanParseDocxAPIView.as_view(), name='lesson-plan-parse-docx'),
    path('lesson-plans/', LessonPlanListAPIView.as_view(), name='lesson-plan-list'),
    path('lesson-plans/<int:pk>/', LessonPlanDetailAPIView.as_view(), name='lesson-plan-detail'),
    path('lesson-plans/<int:pk>/check-duplicate/', LessonPlanCheckDuplicateAPIView.as_view(), name='lesson-plan-check-duplicate'),
    path('lesson-plans/<int:pk>/propose/', LessonPlanProposeAPIView.as_view(), name='lesson-plan-propose'),
    path('lesson-plans/<int:pk>/withdraw/', LessonPlanWithdrawAPIView.as_view(), name='lesson-plan-withdraw'),
    path('lesson-plans/<int:pk>/ratings/', LessonPlanRatingAPIView.as_view(), name='lesson-plan-ratings'),
    path('lesson-plans/upload/', LessonPlanUploadAPIView.as_view(), name='lesson-plan-upload'),
    path('directories/', DirectoryListCreateAPIView.as_view(), name='directory-list-create'),
    path('directories/<int:pk>/', DirectoryDetailAPIView.as_view(), name='directory-detail'),
    path('approval-requests/', ApprovalRequestListCreateAPIView.as_view(), name='approval-request-list-create'),
    path('approval-requests/<int:pk>/', ApprovalRequestDetailAPIView.as_view(), name='approval-request-detail'),
    path('register/', RegisterAPIView.as_view(), name='register'),
    path('login/', LoginAPIView.as_view(), name='login'),
    path('keycloak-mock-login/', KeycloakMockLoginAPIView.as_view(), name='keycloak-mock-login'),
    path('keycloak-login/', KeycloakLoginAPIView.as_view(), name='keycloak-login'),
    path('admin/users/', AdminUserListAPIView.as_view(), name='admin-user-list'),
    path('admin/users/<int:pk>/', AdminUserDetailAPIView.as_view(), name='admin-user-detail'),
    path('admin/users/<int:pk>/permissions/', AdminAssignPermissionAPIView.as_view(), name='admin-assign-permissions'),
    path('users/me/permissions/', UserSelfPermissionsAPIView.as_view(), name='user-self-permissions'),
    path('users/me/profile/', UserProfileUpdateAPIView.as_view(), name='user-profile-update'),
    
    # AI Graph RAG & Chatbot Endpoints
    path('chat-sessions/', AIChatSessionListCreateAPIView.as_view(), name='chat-sessions-list-create'),
    path('chat-sessions/<int:pk>/', AIChatSessionDetailAPIView.as_view(), name='chat-sessions-detail'),
    path('chat-sessions/<int:pk>/send/', AIChatSendMessageAPIView.as_view(), name='chat-sessions-send'),
    path('chat-graph/', AIChatGraphDataAPIView.as_view(), name='chat-graph'),
    
    # New KMS Rebuild APIs
    path('system-settings/', SystemSettingAPIView.as_view(), name='system-settings'),
    path('bg-tasks/status/', BackgroundTasksStatusAPIView.as_view(), name='bg-tasks-status'),
    path('bg-tasks/reprocess/', BackgroundTasksReprocessAPIView.as_view(), name='bg-tasks-reprocess'),
    path('obsidian/status/', ObsidianStatusAPIView.as_view(), name='obsidian-status'),
    path('obsidian/notes/', ObsidianNotesListAPIView.as_view(), name='obsidian-notes-list'),
    path('obsidian/notes/content/', ObsidianNoteContentAPIView.as_view(), name='obsidian-note-content'),
]