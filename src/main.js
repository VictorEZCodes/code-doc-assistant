import './style.css';
import { marked } from 'marked';
import axios from 'axios';

const repoUrlInput = document.getElementById('repo-url');
const connectRepoBtn = document.getElementById('connect-repo');
const generateDocBtn = document.getElementById('generate-doc');
const previewArea = document.getElementById('preview');
const loadingIndicator = document.createElement('div');

loadingIndicator.className = 'fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center hidden';
loadingIndicator.innerHTML = '<div class="bg-white p-4 rounded-lg">Generating documentation...</div>';
document.body.appendChild(loadingIndicator);

const statusCard = document.createElement('div');
statusCard.className = 'fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300 ease-in-out';
document.body.appendChild(statusCard);

if (!import.meta.env.VITE_GITHUB_TOKEN) {
  console.error('GitHub token is missing. Please add VITE_GITHUB_TOKEN to your .env file');
}

if (!import.meta.env.VITE_OPENAI_API_KEY) {
  console.error('OpenAI API key is missing. Please add VITE_OPENAI_API_KEY to your .env file');
}

// API Configurations
const githubConfig = {
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  }
};

const openaiConfig = {
  headers: {
    'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  }
};

function showStatusCard(message, type = 'success') {
  statusCard.className = `fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg transform transition-transform duration-300 ease-in-out ${type === 'success' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
    }`;
  statusCard.innerHTML = `
    <div class="flex items-center">
      <div class="mr-3">
        ${type === 'success'
      ? '<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
      : '<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
    }
      </div>
      <div>
        <p class="font-medium ${type === 'success' ? 'text-green-500' : 'text-red-500'}">${type === 'success' ? 'Success!' : 'Error!'
    }</p>
        <p class="text-sm text-gray-600">${message}</p>
      </div>
    </div>
  `;
  statusCard.style.transform = 'translateX(0)';
  setTimeout(() => {
    statusCard.style.transform = 'translateX(110%)';
  }, 3000);
}

async function connectRepository() {
  try {
    // Disable input and update button state
    repoUrlInput.disabled = true;
    connectRepoBtn.disabled = true;
    connectRepoBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Connecting...
    `;

    if (!import.meta.env.VITE_GITHUB_TOKEN) {
      throw new Error('GitHub token is not configured');
    }

    const repoUrl = repoUrlInput.value;
    if (!repoUrl) {
      throw new Error('Please enter a repository URL');
    }

    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;

    // Verify repository exists
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      githubConfig
    );

    if (response.status === 200) {
      localStorage.setItem('currentRepo', JSON.stringify({ owner, repo }));

      connectRepoBtn.className = 'px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed';
      connectRepoBtn.innerHTML = `
        <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        Connected
      `;
      generateDocBtn.disabled = false;
      generateDocBtn.className = 'px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors';

      showStatusCard('Repository connected successfully!', 'success');
    }
  } catch (error) {
    console.error('Error:', error);
    let errorMessage = 'Error connecting to repository. ';

    if (error.response?.status === 401) {
      errorMessage += 'Invalid or missing GitHub token. Please check your configuration.';
    } else if (error.response?.status === 404) {
      errorMessage += 'Repository not found or private.';
    } else {
      errorMessage += error.message || 'Please check the URL and try again.';
    }

    showStatusCard(errorMessage, 'error');

    connectRepoBtn.disabled = false;
    connectRepoBtn.innerHTML = 'Connect Repository';
    repoUrlInput.disabled = false;
  }
}

async function getRepositoryContents(owner, repo, path = '') {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      githubConfig
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching repository contents:', error);
    throw error;
  }
}

async function getFileContent(owner, repo, path) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      githubConfig
    );
    return atob(response.data.content);
  } catch (error) {
    console.error('Error fetching file content:', error);
    throw error;
  }
}

async function getRepositoryStructure(owner, repo) {
  try {
    const repoResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      githubConfig
    );

    let packageJson = null;
    try {
      const packageResponse = await getFileContent(owner, repo, 'package.json');
      packageJson = JSON.parse(packageResponse);
    } catch (error) {
      console.log('No package.json found');
    }

    let readme = null;
    try {
      readme = await getFileContent(owner, repo, 'README.md');
    } catch (error) {
      console.log('No README.md found');
    }

    return {
      description: repoResponse.data.description,
      packageJson,
      readme
    };
  } catch (error) {
    console.error('Error fetching repository structure:', error);
    throw error;
  }
}

async function getMainSourceFiles(owner, repo) {
  try {
    const allFiles = [];

    // Get src directory contents first
    let srcContents;
    try {
      srcContents = await getRepositoryContents(owner, repo, 'src');
    } catch (error) {
      console.log('Error getting src contents:', error);
      return allFiles;
    }

    // Function to recursively get files from directories
    async function getFilesFromDirectory(contents, currentPath) {
      const files = [];

      for (const item of contents) {
        if (item.type === 'file') {
          if ((item.name.endsWith('.js') ||
            item.name.endsWith('.ts') ||
            item.name.endsWith('.jsx') ||
            item.name.endsWith('.tsx')) &&
            !item.name.includes('.test.') &&
            !item.name.includes('.spec.') &&
            !item.name.includes('.config.')) {
            try {
              const content = await getFileContent(owner, repo, item.path);
              files.push({ path: item.path, content });
            } catch (error) {
              console.log(`Error getting content for ${item.path}:`, error);
            }
          }
        } else if (item.type === 'dir') {
          try {
            const dirContents = await getRepositoryContents(owner, repo, item.path);
            const dirFiles = await getFilesFromDirectory(dirContents, item.path);
            files.push(...dirFiles);
          } catch (error) {
            console.log(`Error getting contents for directory ${item.path}:`, error);
          }
        }
      }

      return files;
    }

    // Get all files recursively
    const files = await getFilesFromDirectory(srcContents, 'src');

    // Sort files by importance
    files.sort((a, b) => {
      const priority = ['index', 'main', 'app'];
      const aName = a.path.toLowerCase();
      const bName = b.path.toLowerCase();

      const aPriority = priority.findIndex(p => aName.includes(p));
      const bPriority = priority.findIndex(p => bName.includes(p));

      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      return 0;
    });

    // Limit to most important files
    allFiles.push(...files.slice(0, 5));

    return allFiles;
  } catch (error) {
    console.error('Error fetching main source files:', error);
    throw error;
  }
}

async function generateDocumentation() {
  // Update button state
  generateDocBtn.disabled = true;
  generateDocBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    Generating Documentation...
  `;
  loadingIndicator.classList.remove('hidden');

  try {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const repoInfo = JSON.parse(localStorage.getItem('currentRepo'));
    if (!repoInfo) {
      throw new Error('Please connect a repository first');
    }

    const repoStructure = await getRepositoryStructure(repoInfo.owner, repoInfo.repo);
    const sourceFiles = await getMainSourceFiles(repoInfo.owner, repoInfo.repo);

    if (sourceFiles.length === 0) {
      throw new Error('No source files found. Please ensure the repository contains JavaScript/TypeScript files.');
    }

    // Generate documentation using OpenAI
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-turbo-preview",
        messages: [{
          role: "system",
          content: "You are a technical documentation expert. Generate comprehensive documentation in a clear, well-structured README format. Include detailed code examples, API references, and changelog where relevant."
        }, {
          role: "user",
          content: `Generate a README.md documentation for the project ${repoInfo.owner}/${repoInfo.repo}

Project Context:
${repoStructure.description || 'No description provided'}
${repoStructure.readme ? '\nFrom README:\n' + repoStructure.readme : ''}
${repoStructure.packageJson ? '\nDependencies:\n' + JSON.stringify(repoStructure.packageJson.dependencies, null, 2) : ''}

Source Files:
${sourceFiles.map(file => `\n--- ${file.path} ---\n${file.content}`).join('\n')}

Please provide a comprehensive README.md including:
1. Project Title and Description
2. Features
3. Technologies Used
4. Installation Guide
5. Usage Instructions
6. API Reference
   - Detailed list of all functions/methods
   - Parameters and return values
   - Example usage for each endpoint/function
7. Architecture Overview
8. Contributing Guidelines
9. Changelog
   - Version history
   - Notable changes
   - Breaking changes
10. License Information

For the API Reference and Changelog sections, please structure them as collapsible sections using markdown:

<details>
<summary>API Reference</summary>

[API documentation content here]

</details>

<details>
<summary>Changelog</summary>

[Changelog content here]

</details>

Format the response as a proper README.md file with appropriate markdown syntax.`
        }],
        temperature: 0.7,
        max_tokens: 4000
      },
      { headers: openaiConfig.headers }
    );

    const documentation = response.data.choices[0].message.content;

    previewArea.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">README.md Preview</h2>
        <div class="space-x-2">
          <button id="raw-view-btn" class="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded">Raw</button>
          <button id="preview-view-btn" class="px-3 py-1 text-sm bg-primary text-white hover:bg-primary/90 rounded">Preview</button>
          <button id="copy-doc-btn" class="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded">Copy to Clipboard</button>
        </div>
      </div>
      <div id="preview-content" class="prose max-w-none p-6 bg-white rounded-lg shadow">
        ${marked(documentation)}
      </div>
      <div id="raw-content" class="hidden">
        <pre class="p-6 bg-gray-50 rounded-lg shadow overflow-x-auto"><code class="text-sm">${documentation.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
      </div>
    `;

    const rawViewBtn = document.getElementById('raw-view-btn');
    const previewViewBtn = document.getElementById('preview-view-btn');
    const copyDocBtn = document.getElementById('copy-doc-btn');
    const previewContent = document.getElementById('preview-content');
    const rawContent = document.getElementById('raw-content');

    rawViewBtn.addEventListener('click', () => {
      rawContent.classList.remove('hidden');
      previewContent.classList.add('hidden');
      rawViewBtn.classList.add('bg-primary', 'text-white');
      rawViewBtn.classList.remove('bg-gray-200');
      previewViewBtn.classList.remove('bg-primary', 'text-white');
      previewViewBtn.classList.add('bg-gray-200');
    });

    previewViewBtn.addEventListener('click', () => {
      previewContent.classList.remove('hidden');
      rawContent.classList.add('hidden');
      previewViewBtn.classList.add('bg-primary', 'text-white');
      previewViewBtn.classList.remove('bg-gray-200');
      rawViewBtn.classList.remove('bg-primary', 'text-white');
      rawViewBtn.classList.add('bg-gray-200');
    });

    copyDocBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(documentation);
      copyDocBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyDocBtn.textContent = 'Copy to Clipboard';
      }, 2000);
    });

    // After successful generation, show success message and reset buttons
    showStatusCard('Documentation generated successfully!', 'success');

    // Reset all buttons and inputs to their initial state
    generateDocBtn.disabled = false;
    generateDocBtn.innerHTML = 'Generate Documentation';
    generateDocBtn.className = 'px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors';

    connectRepoBtn.disabled = false;
    connectRepoBtn.innerHTML = 'Connect Repository';
    connectRepoBtn.className = 'px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors';

    repoUrlInput.disabled = false;

  } catch (error) {
    console.error('Error:', error);
    generateDocBtn.disabled = false;
    generateDocBtn.innerHTML = 'Generate Documentation';
    generateDocBtn.className = 'px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors';
    showStatusCard(error.message || 'Error generating documentation. Please try again.', 'error');
  } finally {
    loadingIndicator.classList.add('hidden');
  }
}

window.addEventListener('unhandledrejection', function (event) {
  console.error('Unhandled promise rejection:', event.reason);
  showStatusCard('An unexpected error occurred. Please check the console for details.', 'error');
});

// Event listeners
connectRepoBtn.addEventListener('click', connectRepository);
generateDocBtn.addEventListener('click', generateDocumentation);

// Initialize UI state
generateDocBtn.disabled = true;
generateDocBtn.className = 'px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed';

const savedRepo = localStorage.getItem('currentRepo');
if (savedRepo) {
  const { owner, repo } = JSON.parse(savedRepo);
  repoUrlInput.value = `https://github.com/${owner}/${repo}`;
  generateDocBtn.disabled = false;
  generateDocBtn.className = 'px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 transition-colors';
  connectRepoBtn.className = 'px-4 py-2 bg-gray-400 text-white rounded cursor-not-allowed';
  connectRepoBtn.innerHTML = `
    <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
    </svg>
    Connected
  `;
}