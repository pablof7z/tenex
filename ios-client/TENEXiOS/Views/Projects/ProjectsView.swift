import SwiftUI

struct ProjectsView: View {
    @EnvironmentObject var projectManager: ProjectManager
    @State private var showingCreateProject = false
    @State private var searchText = ""
    
    var filteredProjects: [Project] {
        if searchText.isEmpty {
            return projectManager.projects
        } else {
            return projectManager.projects.filter { project in
                project.name.localizedCaseInsensitiveContains(searchText) ||
                project.description.localizedCaseInsensitiveContains(searchText) ||
                project.hashtags.contains { $0.localizedCaseInsensitiveContains(searchText) }
            }
        }
    }
    
    var body: some View {
        NavigationView {
            VStack {
                if projectManager.projects.isEmpty && !projectManager.isLoading {
                    EmptyStateView(
                        icon: "folder.badge.plus",
                        title: "No Projects Yet",
                        description: "Create your first project to get started"
                    ) {
                        Button("Create Project") {
                            showingCreateProject = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(filteredProjects) { project in
                            NavigationLink(destination: ProjectDetailView(project: project)) {
                                ProjectRowView(project: project)
                            }
                        }
                        .onDelete(perform: deleteProjects)
                    }
                    .searchable(text: $searchText, prompt: "Search projects")
                    .refreshable {
                        await refreshProjects()
                    }
                }
            }
            .navigationTitle("Projects")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showingCreateProject = true }) {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showingCreateProject) {
                CreateProjectView()
            }
        }
    }
    
    private func deleteProjects(at offsets: IndexSet) {
        Task {
            for index in offsets {
                let project = filteredProjects[index]
                try? await projectManager.deleteProject(project)
            }
        }
    }
    
    private func refreshProjects() async {
        // Force refresh by resubscribing
        projectManager.subscribeToProjects()
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second delay
    }
}

struct ProjectRowView: View {
    let project: Project
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(project.name)
                    .font(.headline)
                
                Spacer()
                
                if project.repo != nil {
                    Image(systemName: "link")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Text(project.description)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            if !project.hashtags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(project.hashtags, id: \.self) { tag in
                            Text("#\(tag)")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.1))
                                .foregroundColor(.blue)
                                .cornerRadius(4)
                        }
                    }
                }
            }
            
            Text(project.created, style: .relative)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}