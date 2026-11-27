// Start
document.addEventListener('DOMContentLoaded', () => {
  ClassManager.init();
  CommentsManager.loadComments();


  // Archive modal backdrop clicks
  document.getElementById('pu-archive-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('pu-archive-modal')) CommentsManager.closeArchiveModal();
  });
  document.getElementById('report-archive-modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('report-archive-modal')) ReportManager.closeArchiveModal();
  });
});
// Class management logic synchronized with categories
