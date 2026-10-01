from django.urls import path
from .views import AnalyticsSummaryView, ForecastAnalyticsView

urlpatterns = [
    path('summary/', AnalyticsSummaryView.as_view(), name='analytics-summary'),
    path('forecast/', ForecastAnalyticsView.as_view(), name='analytics-forecast'),
]

