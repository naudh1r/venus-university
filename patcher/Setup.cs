// The mod's setup wizard: one window that finds the game, installs the photo feature into it, and
// takes it out again. Written for the C# compiler that ships with Windows' .NET Framework 4
// (C# 5: no string interpolation, no `?.`), so it can be built on any Windows PC with nothing
// installed, and it runs on any Windows 10 or 11 PC the same way.
//
// The patch itself is `patch.mjs`, zipped inside this exe with the files it installs. It runs on
// the game's own exe: Venus University is an Electron app, and with ELECTRON_RUN_AS_NODE=1 that
// exe is a plain Node.js, so the player installs nothing.
//
// The build replaces ModVersion, GameVersion and PayloadHash below before compiling.

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;

static class Program
{
    public const string ModName = "Venus University Photo Feature";
    public const string ModVersion = "0.0.0";
    public const string GameVersion = "0.0.0";
    public const string PayloadHash = "0000000000000000000000000000000000000000000000000000000000000000";
    public const string GameExe = "Venus University.exe";

    [DllImport("kernel32.dll")]
    static extern bool AttachConsole(int processId);

    [STAThread]
    static int Main(string[] args)
    {
        // `Setup.exe install|uninstall "<game folder>"` runs without the window and prints what the
        // patch printed, into the console it was started from: for scripting, and for testing.
        if (args.Length == 2 && (args[0] == "install" || args[0] == "uninstall"))
        {
            try { AttachConsole(-1); } catch { }
            Result result = Run(args[0], args[1]).Result;
            Console.WriteLine(result.Output);
            return result.ExitCode;
        }

        // Anything that goes wrong is said, rather than the window never appearing.
        AppDomain.CurrentDomain.UnhandledException += (sender, e) => Report(e.ExceptionObject as Exception);
        Application.ThreadException += (sender, e) => Report(e.Exception);
        try
        {
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
        catch (Exception error)
        {
            Report(error);
            return 1;
        }
        return 0;
    }

    /// <summary>Shows an unexpected error, and leaves it in a text file to send along.</summary>
    static void Report(Exception error)
    {
        string text = error == null ? "Unknown error." : error.ToString();
        string file = Path.Combine(Path.GetTempPath(), "venus-photo-mod-setup-error.txt");
        try { File.WriteAllText(file, DateTime.Now + "\r\n" + text); } catch { }
        MessageBox.Show("The setup ran into an error. Please send this, or the file " + file + ":\r\n\r\n" + text,
            ModName + " Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }

    public class Result
    {
        public int ExitCode;
        public string Output;
    }

    /// <summary>Whether the folder holds the game: its exe, and the code archive the patch edits.</summary>
    public static bool IsGame(string folder)
    {
        return !string.IsNullOrWhiteSpace(folder)
            && File.Exists(Path.Combine(folder, GameExe))
            && File.Exists(Path.Combine(folder, "resources", "app.asar"));
    }

    /// <summary>The version of the photo feature installed in the folder, or null when none is.</summary>
    public static string InstalledVersion(string folder)
    {
        string marker = Path.Combine(folder, "resources", "photo-mod.json");
        if (!File.Exists(marker)) return null;
        Match match = Regex.Match(File.ReadAllText(marker), "\"modVersion\"\\s*:\\s*\"([^\"]+)\"");
        return match.Success ? match.Groups[1].Value : "unknown";
    }

    /// <summary>The game folder this exe sits in or beside, if it is one.</summary>
    public static string GuessGame()
    {
        string here = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        if (IsGame(here)) return here;
        DirectoryInfo parent = Directory.GetParent(here);
        if (parent != null && IsGame(parent.FullName)) return parent.FullName;
        return "";
    }

    /// <summary>Unpacks the embedded patch to a fresh temp folder, after checking it is the one built.</summary>
    static string Extract()
    {
        byte[] bytes;
        using (Stream input = Assembly.GetExecutingAssembly().GetManifestResourceStream("PhotoModPayload"))
        {
            if (input == null) throw new Exception("The installer is damaged: its package is missing.");
            using (MemoryStream memory = new MemoryStream())
            {
                input.CopyTo(memory);
                bytes = memory.ToArray();
            }
        }
        using (SHA256 sha = SHA256.Create())
        {
            string hash = BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-", "").ToLowerInvariant();
            if (hash != PayloadHash) throw new Exception("The installer is damaged: its package does not match. Download it again.");
        }

        string dir = Path.Combine(Path.GetTempPath(), "venus-photo-mod-" + Guid.NewGuid().ToString("N"));
        string root = Path.GetFullPath(dir) + Path.DirectorySeparatorChar;
        Directory.CreateDirectory(dir);
        using (ZipArchive zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read))
        {
            foreach (ZipArchiveEntry entry in zip.Entries)
            {
                string target = Path.GetFullPath(Path.Combine(dir, entry.FullName));
                if (!target.StartsWith(root, StringComparison.Ordinal)) throw new Exception("The installer is damaged: a file points outside its folder.");
                if (entry.FullName.EndsWith("/")) { Directory.CreateDirectory(target); continue; }
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                using (Stream from = entry.Open())
                using (FileStream to = File.Create(target)) from.CopyTo(to);
            }
        }
        return dir;
    }

    /// <summary>Runs `patch.mjs <action> <game>` on the game's own exe, and hands back what it printed.</summary>
    public static async Task<Result> Run(string action, string game)
    {
        game = Path.GetFullPath(game).TrimEnd(Path.DirectorySeparatorChar);
        if (!IsGame(game)) return new Result { ExitCode = 1, Output = "\"" + GameExe + "\" was not found in that folder." };
        string dir = null;
        try
        {
            dir = await Task.Run(() => Extract());
            ProcessStartInfo info = new ProcessStartInfo(Path.Combine(game, GameExe),
                "\"" + Path.Combine(dir, "patch.mjs") + "\" " + action + " \"" + game + "\"");
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            info.WorkingDirectory = dir;
            info.RedirectStandardInput = true;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            using (Process process = Process.Start(info))
            {
                // Nothing to answer: the folder is given, so the patch never asks.
                process.StandardInput.Close();
                Task<string> stdout = process.StandardOutput.ReadToEndAsync();
                Task<string> stderr = process.StandardError.ReadToEndAsync();
                bool done = await Task.Run(() => process.WaitForExit(10 * 60 * 1000));
                if (!done)
                {
                    try { process.Kill(); } catch { }
                    return new Result { ExitCode = 1, Output = "The " + action + " did not finish within ten minutes and was stopped." };
                }
                string output = ((await stdout) + "\n" + (await stderr)).Trim();
                return new Result { ExitCode = process.ExitCode, Output = output };
            }
        }
        catch (Exception error)
        {
            return new Result { ExitCode = 1, Output = error.Message };
        }
        finally
        {
            if (dir != null) { try { Directory.Delete(dir, true); } catch { } }
        }
    }
}

class SetupForm : Form
{
    readonly TextBox folder = new TextBox();
    readonly Label status = new Label();
    readonly TextBox log = new TextBox();
    readonly Button browse = new Button();
    readonly Button install = new Button();
    readonly Button uninstall = new Button();
    readonly Button close = new Button();
    bool busy;

    public SetupForm()
    {
        Text = Program.ModName + " " + Program.ModVersion + " Setup";
        Font = new Font("Segoe UI", 9.5f);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(600, 470);

        Label title = new Label();
        title.Text = Program.ModName;
        title.Font = new Font("Segoe UI", 15f, FontStyle.Bold);
        title.SetBounds(24, 18, 552, 32);
        Controls.Add(title);

        Label version = new Label();
        version.Text = "Version " + Program.ModVersion + ", for Venus University " + Program.GameVersion + " (the official Windows build)";
        version.ForeColor = Color.DimGray;
        version.SetBounds(24, 52, 552, 20);
        Controls.Add(version);

        Label about = new Label();
        about.Text =
            "Adds photos to Bunnyboard feeds and DMs. Photos need ComfyUI with the game's own models.\r\n\r\n" +
            "Close the game before installing or uninstalling. Your saves are not touched.\r\n" +
            "Not compatible with other mods that change the game's code.";
        about.SetBounds(24, 82, 552, 76);
        Controls.Add(about);

        Label folderLabel = new Label();
        folderLabel.Text = "Game folder (where \"" + Program.GameExe + "\" is):";
        folderLabel.SetBounds(24, 166, 552, 20);
        Controls.Add(folderLabel);

        folder.SetBounds(24, 188, 456, 26);
        folder.Text = Program.GuessGame();
        folder.TextChanged += (sender, e) => UpdateState();
        Controls.Add(folder);

        browse.Text = "Browse...";
        browse.SetBounds(488, 187, 88, 28);
        browse.Click += (sender, e) => Browse();
        Controls.Add(browse);

        status.SetBounds(24, 222, 552, 22);
        status.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
        Controls.Add(status);

        log.Multiline = true;
        log.ReadOnly = true;
        log.ScrollBars = ScrollBars.Vertical;
        log.BackColor = SystemColors.Window;
        log.Font = new Font("Consolas", 9f);
        log.SetBounds(24, 250, 552, 160);
        Controls.Add(log);

        install.Text = "Install";
        install.SetBounds(308, 424, 88, 30);
        install.Click += (sender, e) => Act("install");
        Controls.Add(install);

        uninstall.Text = "Uninstall";
        uninstall.SetBounds(398, 424, 88, 30);
        uninstall.Click += (sender, e) => Act("uninstall");
        Controls.Add(uninstall);

        close.Text = "Close";
        close.SetBounds(488, 424, 88, 30);
        close.Click += (sender, e) => Close();
        Controls.Add(close);

        AcceptButton = install;
        CancelButton = close;
        FormClosing += (sender, e) => { if (busy) e.Cancel = true; };
        UpdateState();
    }

    void Browse()
    {
        using (FolderBrowserDialog dialog = new FolderBrowserDialog())
        {
            dialog.Description = "Choose the Venus University folder, the one with \"" + Program.GameExe + "\" in it.";
            if (Directory.Exists(folder.Text)) dialog.SelectedPath = folder.Text;
            if (dialog.ShowDialog(this) == DialogResult.OK) folder.Text = dialog.SelectedPath;
        }
    }

    /// <summary>Says what is in the chosen folder, and enables only what makes sense for it.</summary>
    void UpdateState()
    {
        string game = folder.Text.Trim().Trim('"');
        bool isGame = Program.IsGame(game);
        string installed = isGame ? Program.InstalledVersion(game) : null;

        if (!isGame)
        {
            status.ForeColor = Color.Firebrick;
            status.Text = game.Length == 0 ? "Choose the game folder." : "\"" + Program.GameExe + "\" is not in this folder.";
        }
        else if (installed == null)
        {
            status.ForeColor = Color.SeaGreen;
            status.Text = "Venus University found. Ready to install.";
        }
        else if (installed == Program.ModVersion)
        {
            status.ForeColor = Color.SeaGreen;
            status.Text = "Photo Feature " + installed + " is installed.";
        }
        else
        {
            status.ForeColor = Color.DarkOrange;
            status.Text = "Photo Feature " + installed + " is installed. Uninstall it first, then install " + Program.ModVersion + ".";
        }

        browse.Enabled = !busy;
        folder.Enabled = !busy;
        install.Enabled = !busy && isGame && installed == null;
        uninstall.Enabled = !busy && isGame && installed != null;
        close.Enabled = !busy;
    }

    async void Act(string action)
    {
        string game = folder.Text.Trim().Trim('"');
        if (Process.GetProcessesByName(Path.GetFileNameWithoutExtension(Program.GameExe)).Length > 0)
        {
            MessageBox.Show(this, "Venus University is running. Close the game first, then try again.", Text,
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        busy = true;
        UpdateState();
        log.Text = (action == "install" ? "Installing" : "Uninstalling") + "... this can take a minute.";
        Program.Result result = await Program.Run(action, game);
        busy = false;
        log.Text = result.Output.Replace("\r\n", "\n").Replace("\n", "\r\n");
        UpdateState();

        if (result.ExitCode == 0)
        {
            MessageBox.Show(this,
                action == "install"
                    ? "The photo feature is installed. Start the game as usual."
                    : "The photo feature is removed. The game is back to the official version.",
                Text, MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        else
        {
            MessageBox.Show(this, "That did not work. The details are in the box above.", Text,
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}
