import SwiftUI

struct TasksView: View {
    let project: Project
    
    var body: some View {
        TaskListView(project: project)
    }
}